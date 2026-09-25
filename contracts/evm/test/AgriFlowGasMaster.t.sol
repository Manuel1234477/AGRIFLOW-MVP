// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgriFlowGasMaster} from "../src/AgriFlowGasMaster.sol";
import {AgriFlowEscrow} from "../src/AgriFlowEscrow.sol";
import {IAgriFlowGasMaster} from "../src/interfaces/IAgriFlowGasMaster.sol";
import {IAgriFlowEscrow} from "../src/interfaces/IAgriFlowEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract MockRevertingTarget {
    function failWithReason() external pure {
        revert("TargetReverted");
    }

    function failWithEmpty() external pure {
        assembly {
            revert(0, 0)
        }
    }

    function succeedWithValue() external payable returns (uint256) {
        return msg.value;
    }
}

contract AgriFlowGasMasterTest is Test {
    AgriFlowGasMaster public gasMaster;
    AgriFlowEscrow public escrow;
    MockERC20 public usdc;
    MockRevertingTarget public revertTarget;

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

        address[] memory initialTargets = new address[](1);
        initialTargets[0] = makeAddr("initialTarget");
        gasMaster = new AgriFlowGasMaster(treasury, initialTargets);

        escrow = new AgriFlowEscrow(treasury, relayer, address(gasMaster));
        revertTarget = new MockRevertingTarget();

        vm.startPrank(treasury);
        gasMaster.setTargetWhitelist(address(escrow), true);
        gasMaster.setTargetWhitelist(address(revertTarget), true);
        vm.stopPrank();

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

    // --- Constructor & Admin Tests ---

    function test_Constructor_RevertIf_ZeroAddressOwner() public {
        address[] memory targets = new address[](0);
        vm.expectRevert(abi.encodeWithSignature("OwnableInvalidOwner(address)", address(0)));
        new AgriFlowGasMaster(address(0), targets);
    }

    function test_SetTargetWhitelist_SuccessAndReverts() public {
        address testTarget = makeAddr("testTarget");

        vm.prank(treasury);
        gasMaster.setTargetWhitelist(testTarget, true);
        assertTrue(gasMaster.isWhitelisted(testTarget));

        vm.prank(treasury);
        gasMaster.setTargetWhitelist(testTarget, false);
        assertFalse(gasMaster.isWhitelisted(testTarget));

        vm.prank(treasury);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterZeroAddress.selector));
        gasMaster.setTargetWhitelist(address(0), true);

        // Non-owner
        vm.prank(relayer);
        vm.expectRevert();
        gasMaster.setTargetWhitelist(testTarget, true);
    }

    function test_SetTargetBatchWhitelist() public {
        address[] memory targets = new address[](2);
        targets[0] = makeAddr("batchTarget1");
        targets[1] = makeAddr("batchTarget2");

        vm.prank(treasury);
        gasMaster.setTargetBatchWhitelist(targets, true);
        assertTrue(gasMaster.isWhitelisted(targets[0]));
        assertTrue(gasMaster.isWhitelisted(targets[1]));

        address[] memory badTargets = new address[](1);
        badTargets[0] = address(0);
        vm.prank(treasury);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterZeroAddress.selector));
        gasMaster.setTargetBatchWhitelist(badTargets, true);
    }

    function test_AdminSetters() public {
        vm.startPrank(treasury);
        gasMaster.setRateLimitCooldown(10);
        assertEq(gasMaster.rateLimitCooldown(), 10);

        gasMaster.setMaxGasLimit(3_000_000);
        assertEq(gasMaster.maxGasLimit(), 3_000_000);

        gasMaster.setRelayerRefundConfig(true, 50 gwei);
        assertTrue(gasMaster.gasRefundEnabled());
        assertEq(gasMaster.maxRefundGasPrice(), 50 gwei);
        vm.stopPrank();
    }

    // --- Gas Tank Tests ---

    function test_GasTank_DepositAndWithdraw() public {
        // Direct transfer triggers receive()
        vm.deal(relayer, 10 ether);
        vm.prank(relayer);
        (bool sent, ) = address(gasMaster).call{value: 2 ether}("");
        assertTrue(sent);
        assertEq(gasMaster.getGasTankBalance(), 2 ether);

        // fallback()
        vm.prank(relayer);
        (bool sentFallback, ) = address(gasMaster).call{value: 1 ether}(hex"123456");
        assertTrue(sentFallback);
        assertEq(gasMaster.getGasTankBalance(), 3 ether);

        // depositGasTank()
        vm.prank(relayer);
        gasMaster.depositGasTank{value: 1 ether}();
        assertEq(gasMaster.getGasTankBalance(), 4 ether);

        // Withdraw from gas tank by owner
        address payable recipient = payable(makeAddr("recipient"));
        vm.prank(treasury);
        gasMaster.withdrawGasTank(recipient, 2.5 ether);
        assertEq(recipient.balance, 2.5 ether);
        assertEq(gasMaster.getGasTankBalance(), 1.5 ether);

        // Revert on zero address
        vm.prank(treasury);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterZeroAddress.selector));
        gasMaster.withdrawGasTank(payable(address(0)), 1 ether);

        // Revert on insufficient balance
        vm.prank(treasury);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterInsufficientTankBalance.selector, 10 ether, 1.5 ether));
        gasMaster.withdrawGasTank(recipient, 10 ether);
    }

    // --- Meta-Transaction Execution Tests ---

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

        // Verify function returns true
        assertTrue(gasMaster.verify(req, signature));

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

    function test_Gasless_ExecuteWithRelayerRefund() public {
        // Fund gas tank
        vm.deal(treasury, 5 ether);
        vm.prank(treasury);
        gasMaster.depositGasTank{value: 2 ether}();

        // Enable refunds
        vm.prank(treasury);
        gasMaster.setRelayerRefundConfig(true, 100 gwei);

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

        uint256 relayerBalBefore = relayer.balance;
        vm.txGasPrice(20 gwei);
        vm.prank(relayer);
        gasMaster.execute(req, signature);

        assertTrue(relayer.balance > relayerBalBefore);
    }

    function test_TryExecute_SuccessAndFailure() public {
        bytes memory callData = abi.encodeWithSelector(MockRevertingTarget.failWithReason.selector);

        IAgriFlowGasMaster.ForwardRequest memory req = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(revertTarget),
            value: 0,
            gas: 200_000,
            nonce: gasMaster.getNonce(buyer),
            deadline: block.timestamp + 1 hours,
            data: callData
        });

        bytes memory signature = _signRequest(buyerPrivateKey, req);

        // tryExecute catches the destination revert and returns false without reverting outer transaction
        vm.prank(relayer);
        (bool success, ) = gasMaster.tryExecute(req, signature);
        assertFalse(success);
        assertEq(gasMaster.getNonce(buyer), 1);
    }

    function test_ExecuteBatch() public {
        IAgriFlowGasMaster.ForwardRequest[] memory requests = new IAgriFlowGasMaster.ForwardRequest[](2);
        bytes[] memory signatures = new bytes[](2);

        // Request 1: Valid
        bytes memory callData1 = abi.encodeWithSelector(IAgriFlowEscrow.confirmDelivery.selector, tradeId);
        requests[0] = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(escrow),
            value: 0,
            gas: 200_000,
            nonce: 0,
            deadline: block.timestamp + 1 hours,
            data: callData1
        });
        signatures[0] = _signRequest(buyerPrivateKey, requests[0]);

        // Request 2: Invalid deadline
        requests[1] = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(escrow),
            value: 0,
            gas: 200_000,
            nonce: 1,
            deadline: block.timestamp - 1,
            data: callData1
        });
        signatures[1] = _signRequest(buyerPrivateKey, requests[1]);

        vm.prank(relayer);
        bool[] memory results = gasMaster.executeBatch(requests, signatures);
        assertEq(results.length, 2);
        assertTrue(results[0]);
        assertFalse(results[1]);

        // Mismatched array length
        bytes[] memory shortSigs = new bytes[](1);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterInvalidArrayLength.selector));
        gasMaster.executeBatch(requests, shortSigs);
    }

    function test_RevertIf_RateLimitExceeded() public {
        vm.warp(1000);
        vm.prank(treasury);
        gasMaster.setRateLimitCooldown(60);

        bytes memory callData = abi.encodeWithSelector(IAgriFlowEscrow.confirmDelivery.selector, tradeId);

        IAgriFlowGasMaster.ForwardRequest memory req1 = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(escrow),
            value: 0,
            gas: 200_000,
            nonce: 0,
            deadline: block.timestamp + 1 hours,
            data: callData
        });
        bytes memory sig1 = _signRequest(buyerPrivateKey, req1);

        vm.prank(relayer);
        gasMaster.execute(req1, sig1);

        // Next request immediately afterwards should fail rate limit
        IAgriFlowGasMaster.ForwardRequest memory req2 = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(escrow),
            value: 0,
            gas: 200_000,
            nonce: 1,
            deadline: block.timestamp + 1 hours,
            data: callData
        });
        bytes memory sig2 = _signRequest(buyerPrivateKey, req2);

        assertFalse(gasMaster.verify(req2, sig2));

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterRateLimitExceeded.selector, buyer, 1060));
        gasMaster.execute(req2, sig2);
    }

    function test_RevertIf_GasLimitExceeded() public {
        vm.prank(treasury);
        gasMaster.setMaxGasLimit(100_000);

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
        bytes memory sig = _signRequest(buyerPrivateKey, req);

        assertFalse(gasMaster.verify(req, sig));

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterGasLimitExceeded.selector, 200_000, 100_000));
        gasMaster.execute(req, sig);
    }

    function test_RevertIf_InvalidSigner() public {
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

        // Signed by wrong private key
        uint256 imposterPrivateKey = 0xB0B;
        bytes memory sig = _signRequest(imposterPrivateKey, req);

        assertFalse(gasMaster.verify(req, sig));

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterInvalidSigner.selector, vm.addr(imposterPrivateKey), buyer));
        gasMaster.execute(req, sig);
    }

    function test_RevertIf_DestinationRevertsBubblesUp() public {
        bytes memory callData = abi.encodeWithSelector(MockRevertingTarget.failWithReason.selector);

        IAgriFlowGasMaster.ForwardRequest memory req = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(revertTarget),
            value: 0,
            gas: 200_000,
            nonce: 0,
            deadline: block.timestamp + 1 hours,
            data: callData
        });
        bytes memory sig = _signRequest(buyerPrivateKey, req);

        vm.prank(relayer);
        vm.expectRevert("TargetReverted");
        gasMaster.execute(req, sig);
    }

    function test_RevertIf_EmptyRevertBubblesUp() public {
        bytes memory callData = abi.encodeWithSelector(MockRevertingTarget.failWithEmpty.selector);

        IAgriFlowGasMaster.ForwardRequest memory req = IAgriFlowGasMaster.ForwardRequest({
            from: buyer,
            to: address(revertTarget),
            value: 0,
            gas: 200_000,
            nonce: 0,
            deadline: block.timestamp + 1 hours,
            data: callData
        });
        bytes memory sig = _signRequest(buyerPrivateKey, req);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowGasMaster.GasMasterCallFailed.selector, ""));
        gasMaster.execute(req, sig);
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
