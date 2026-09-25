// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgriFlowGasMaster} from "../src/AgriFlowGasMaster.sol";
import {AgriFlowEscrow} from "../src/AgriFlowEscrow.sol";
import {IAgriFlowGasMaster} from "../src/interfaces/IAgriFlowGasMaster.sol";
import {IAgriFlowEscrow} from "../src/interfaces/IAgriFlowEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract AgriFlowGasMasterTest is Test {
    AgriFlowGasMaster public gasMaster;
    AgriFlowEscrow public escrow;
    MockERC20 public usdc;

    address public treasury = makeAddr("treasury");
    address public relayer = makeAddr("relayer");
    
    // Buyer with private key for EIP-712 signing
    uint256 public buyerPrivateKey = 0xA11CE;
    address public buyer;

    address public supplier = makeAddr("supplier");
    address public logistics = makeAddr("logistics");
    address public depositAddress = makeAddr("depositAddress");

    bytes32 public tradeId = keccak256("GASLESS-TRADE-001");
    string public intentTxHash = "0xabcdef1234567890";

    uint256 public goodsAmount = 1_000 * 1e6;
    uint256 public logisticsAmount = 100 * 1e6;
    uint256 public platformFee = 10 * 1e6;

    bytes32 public constant FORWARD_REQUEST_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint256 deadline,bytes data)"
    );

    function setUp() public {
        buyer = vm.addr(buyerPrivateKey);

        address[] memory initialTargets = new address[](0);
        gasMaster = new AgriFlowGasMaster(treasury, initialTargets);

        escrow = new AgriFlowEscrow(treasury, relayer, address(gasMaster));

        vm.prank(treasury);
        gasMaster.setTargetWhitelist(address(escrow), true);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        usdc.mint(relayer, 100_000 * 1e6);

        vm.prank(relayer);
        usdc.approve(address(escrow), type(uint256).max);

        // Fund escrow with trade
        vm.prank(relayer);
        escrow.fundTradeFromIntent(
            tradeId,
            buyer,
            supplier,
            logistics,
            address(usdc),
            depositAddress,
            intentTxHash,
            goodsAmount,
            logisticsAmount,
            platformFee
        );
    }

    function _signRequest(
        uint256 privateKey,
        IAgriFlowGasMaster.ForwardRequest memory req
    ) internal view returns (bytes memory) {
        (, string memory name, string memory version, uint256 chainId, address verifyingContract, , ) = gasMaster
            .eip712Domain();

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(
                FORWARD_REQUEST_TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                req.deadline,
                keccak256(req.data)
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_Gasless_ConfirmDelivery() public {
        bytes memory callData = abi.encodeWithSelector(IAgriFlowEscrow.confirmDelivery.selector, tradeId);

        IAgriFlowGasMaster.ForwardRequest memory req = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(escrow),
            value: 0,
            gas: 200_000,
            nonce: gasMaster.getNonce(buyer),
            deadline: block.timestamp + 1 hours,
            data: callData
        });

        bytes memory signature = _signRequest(buyerPrivateKey, req);

        // Relayer submits meta-transaction on behalf of buyer
        vm.prank(relayer);
        (bool success, ) = gasMaster.execute(req, signature);
        assertTrue(success);

        // Verify state is completed
        IAgriFlowEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(IAgriFlowEscrow.TradeStatus.COMPLETED));

        // Verify nonce incremented
        assertEq(gasMaster.getNonce(buyer), 1);
    }

    function test_RevertIf_SignatureReplayed() public {
        bytes memory callData = abi.encodeWithSelector(IAgriFlowEscrow.confirmDelivery.selector, tradeId);

        IAgriFlowGasMaster.ForwardRequest memory req = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(escrow),
            value: 0,
            gas: 200_000,
            nonce: 0,
            deadline: block.timestamp + 1 hours,
            data: callData
        });

        bytes memory signature = _signRequest(buyerPrivateKey, req);

        vm.prank(relayer);
        gasMaster.execute(req, signature);

        // Second execution with same nonce must revert
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterInvalidNonce.selector, 0, 1));
        gasMaster.execute(req, signature);
    }

    function test_RevertIf_ExpiredDeadline() public {
        bytes memory callData = abi.encodeWithSelector(IAgriFlowEscrow.confirmDelivery.selector, tradeId);

        IAgriFlowGasMaster.ForwardRequest memory req = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(escrow),
            value: 0,
            gas: 200_000,
            nonce: 0,
            deadline: block.timestamp - 1, // Expired
            data: callData
        });

        bytes memory signature = _signRequest(buyerPrivateKey, req);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterRequestExpired.selector, block.timestamp - 1, block.timestamp)
        );
        gasMaster.execute(req, signature);
    }

    function test_RevertIf_TargetNotWhitelisted() public {
        address unapprovedTarget = makeAddr("unapprovedTarget");
        bytes memory callData = hex"1234";

        IAgriFlowGasMaster.ForwardRequest memory req = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: unapprovedTarget,
            value: 0,
            gas: 200_000,
            nonce: 0,
            deadline: block.timestamp + 1 hours,
            data: callData
        });

        bytes memory signature = _signRequest(buyerPrivateKey, req);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterTargetNotWhitelisted.selector, unapprovedTarget));
        gasMaster.execute(req, signature);
    }
}
