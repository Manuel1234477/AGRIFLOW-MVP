// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgriFlowEscrow} from "../src/AgriFlowEscrow.sol";
import {AgriFlowGasMaster} from "../src/AgriFlowGasMaster.sol";
import {IAgriFlowEscrow} from "../src/interfaces/IAgriFlowEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract AgriFlowEscrowTest is Test {
    AgriFlowEscrow public escrow;
    AgriFlowGasMaster public gasMaster;
    MockERC20 public usdc;

    address public treasury = makeAddr("treasury");
    address public relayer = makeAddr("relayer");
    address public buyer = makeAddr("buyer");
    address public supplier = makeAddr("supplier");
    address public logistics = makeAddr("logistics");
    address public depositAddress = makeAddr("depositAddress");

    bytes32 public tradeId = keccak256("TRADE-001");
    string public intentTxHash = "0x9876543210abcdef";

    uint256 public goodsAmount = 5_000 * 1e6; // 5000 USDC
    uint256 public logisticsAmount = 400 * 1e6; // 400 USDC
    uint256 public platformFee = 50 * 1e6; // 50 USDC
    uint256 public totalAmount = 5_450 * 1e6;

    function setUp() public {
        address[] memory initialTargets = new address[](0);
        gasMaster = new AgriFlowGasMaster(treasury, initialTargets);

        escrow = new AgriFlowEscrow(treasury, relayer, address(gasMaster));

        vm.prank(treasury);
        gasMaster.setTargetWhitelist(address(escrow), true);

        usdc = new MockERC20("USD Coin", "USDC", 6);

        // Fund relayer with USDC and ETH
        usdc.mint(relayer, 100_000 * 1e6);
        vm.deal(relayer, 100 ether);

        vm.prank(relayer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_HappyPath_ERC20() public {
        // 1. Relayer funds trade
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

        // Verify trade state
        IAgriFlowEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(IAgriFlowEscrow.TradeStatus.FUNDED));
        assertEq(trade.buyer, buyer);
        assertEq(trade.supplier, supplier);
        assertEq(trade.logistics, logistics);
        assertEq(trade.generatedDepositAddress, depositAddress);
        assertEq(trade.intentTxHash, intentTxHash);

        bytes32 expectedHash = escrow.computeTradeHash(
            tradeId,
            buyer,
            supplier,
            logistics,
            goodsAmount,
            logisticsAmount,
            depositAddress
        );
        assertEq(trade.detailsHash, expectedHash);
        assertEq(usdc.balanceOf(address(escrow)), totalAmount);

        // 2. Buyer confirms delivery
        vm.prank(buyer);
        escrow.confirmDelivery(tradeId);

        trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(IAgriFlowEscrow.TradeStatus.COMPLETED));

        // 3. Verify internal withdrawable balances
        assertEq(escrow.getWithdrawableBalance(supplier, address(usdc)), goodsAmount);
        assertEq(escrow.getWithdrawableBalance(logistics, address(usdc)), logisticsAmount);
        assertEq(escrow.getWithdrawableBalance(treasury, address(usdc)), platformFee);

        // 4. Supplier, Logistics, and Treasury withdraw funds
        vm.prank(supplier);
        escrow.withdraw(address(usdc));
        assertEq(usdc.balanceOf(supplier), goodsAmount);
        assertEq(escrow.getWithdrawableBalance(supplier, address(usdc)), 0);

        vm.prank(logistics);
        escrow.withdraw(address(usdc));
        assertEq(usdc.balanceOf(logistics), logisticsAmount);
        assertEq(escrow.getWithdrawableBalance(logistics, address(usdc)), 0);

        vm.prank(treasury);
        escrow.withdraw(address(usdc));
        assertEq(usdc.balanceOf(treasury), platformFee);
        assertEq(escrow.getWithdrawableBalance(treasury, address(usdc)), 0);

        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_HappyPath_NativeETH() public {
        uint256 ethGoods = 2 ether;
        uint256 ethLogistics = 0.2 ether;
        uint256 ethFee = 0.02 ether;
        uint256 ethTotal = 2.22 ether;

        vm.prank(relayer);
        escrow.fundTradeFromIntent{value: ethTotal}(
            tradeId,
            buyer,
            supplier,
            logistics,
            address(0),
            depositAddress,
            intentTxHash,
            ethGoods,
            ethLogistics,
            ethFee
        );

        assertEq(address(escrow).balance, ethTotal);

        vm.prank(buyer);
        escrow.confirmDelivery(tradeId);

        vm.prank(supplier);
        escrow.withdrawETH();
        assertEq(supplier.balance, ethGoods);

        vm.prank(logistics);
        escrow.withdrawETH();
        assertEq(logistics.balance, ethLogistics);

        vm.prank(treasury);
        escrow.withdrawETH();
        assertEq(treasury.balance, ethFee);

        assertEq(address(escrow).balance, 0);
    }

    function test_RevertIf_UnauthorizedFundCaller() public {
        address unauthorized = makeAddr("unauthorized");
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowEscrow.UnauthorizedCaller.selector, unauthorized));
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

    function test_RevertIf_DuplicateTradeFunding() public {
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

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowEscrow.TradeAlreadyExists.selector, tradeId));
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

    function test_RevertIf_NonBuyerConfirmsDelivery() public {
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

        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowEscrow.UnauthorizedCaller.selector, stranger));
        escrow.confirmDelivery(tradeId);
    }

    function test_DisputeAndRefund() public {
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

        // Buyer raises dispute
        vm.prank(buyer);
        escrow.raiseDispute(tradeId);

        IAgriFlowEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(IAgriFlowEscrow.TradeStatus.DISPUTED));

        // Owner/Admin refunds buyer
        vm.prank(treasury);
        escrow.refundBuyer(tradeId);

        trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(IAgriFlowEscrow.TradeStatus.REFUNDED));

        // Buyer withdraws full refunded amount
        assertEq(escrow.getWithdrawableBalance(buyer, address(usdc)), totalAmount);
        vm.prank(buyer);
        escrow.withdraw(address(usdc));

        assertEq(usdc.balanceOf(buyer), totalAmount);
        assertEq(escrow.getWithdrawableBalance(supplier, address(usdc)), 0);
    }

    function test_RevertIf_WithdrawWithZeroBalance() public {
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IAgriFlowEscrow.NoWithdrawableBalance.selector));
        escrow.withdraw(address(usdc));
    }
}
