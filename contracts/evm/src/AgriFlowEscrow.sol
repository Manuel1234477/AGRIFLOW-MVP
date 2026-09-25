// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IAgriFlowEscrow} from "./interfaces/IAgriFlowEscrow.sol";

/**
 * @title AgriFlowEscrow
 * @notice Multi-Party Vault Escrow with Generated Deposit Address Tracking and Cryptographic Trade Hashing.
 * @dev Inherits OpenZeppelin v5 ERC2771Context for native gasless confirmation and withdrawal via AgriFlowGasMaster.
 */
contract AgriFlowEscrow is IAgriFlowEscrow, ERC2771Context, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Treasury account collecting platform fees
    address public treasury;

    /// @notice Authorized relayer submitting intent settlements
    address public relayer;

    /// @notice Mapping of tradeId to Trade record
    mapping(bytes32 => Trade) public trades;

    /// @notice Internal pull-vault balances: user => token => withdrawable balance (token == address(0) for native ETH)
    mapping(address => mapping(address => uint256)) public withdrawableBalances;

    /**
     * @notice Constructor initializing treasury, relayer, trusted forwarder, and contract ownership.
     * @param initialTreasury Platform treasury address.
     * @param initialRelayer Authorized relayer address for Intent funding.
     * @param trustedForwarder Address of the AgriFlowGasMaster contract.
     */
    constructor(
        address initialTreasury,
        address initialRelayer,
        address trustedForwarder
    ) ERC2771Context(trustedForwarder) Ownable(initialTreasury) {
        if (initialTreasury == address(0) || initialRelayer == address(0) || trustedForwarder == address(0)) {
            revert ZeroAddress();
        }

        treasury = initialTreasury;
        relayer = initialRelayer;
    }

    // --- Context Overrides for ERC-2771 & Ownable ---

    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    // --- Configuration ---

    /**
     * @notice Updates the relayer address.
     * @param newRelayer New relayer address.
     */
    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        address old = relayer;
        relayer = newRelayer;
        emit RelayerUpdated(old, newRelayer);
    }

    /**
     * @notice Updates the platform treasury address.
     * @param newTreasury New treasury address.
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    // --- Core Escrow Logic ---

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function computeTradeHash(
        bytes32 tradeId,
        address buyer,
        address supplier,
        address logistics,
        uint256 goodsAmount,
        uint256 logisticsAmount,
        address generatedDepositAddress
    ) public pure override returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                tradeId,
                buyer,
                supplier,
                logistics,
                goodsAmount,
                logisticsAmount,
                generatedDepositAddress
            )
        );
    }

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function fundTradeFromIntent(
        bytes32 tradeId,
        address buyer,
        address supplier,
        address logistics,
        address token,
        address generatedDepositAddress,
        string calldata intentTxHash,
        uint256 goodsAmount,
        uint256 logisticsAmount,
        uint256 platformFee
    ) external payable override nonReentrant {
        address caller = _msgSender();
        if (caller != relayer && caller != owner()) {
            revert UnauthorizedCaller(caller);
        }

        if (trades[tradeId].status != TradeStatus.NONE) {
            revert TradeAlreadyExists(tradeId);
        }

        if (buyer == address(0) || supplier == address(0) || generatedDepositAddress == address(0)) {
            revert ZeroAddress();
        }

        uint256 totalRequired = goodsAmount + logisticsAmount + platformFee;
        if (totalRequired == 0) {
            revert InvalidAmount();
        }

        // Fund escrow: handle native ETH or ERC-20 (USDC)
        if (token == address(0)) {
            if (msg.value < totalRequired) {
                revert InsufficientPayment(msg.value, totalRequired);
            }
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), totalRequired);
        }

        bytes32 detailsHash = computeTradeHash(
            tradeId,
            buyer,
            supplier,
            logistics,
            goodsAmount,
            logisticsAmount,
            generatedDepositAddress
        );

        Trade storage trade = trades[tradeId];
        trade.tradeId = tradeId;
        trade.buyer = buyer;
        trade.supplier = supplier;
        trade.logistics = logistics;
        trade.token = token;
        trade.generatedDepositAddress = generatedDepositAddress;
        trade.detailsHash = detailsHash;
        trade.intentTxHash = intentTxHash;
        trade.goodsAmount = goodsAmount;
        trade.logisticsAmount = logisticsAmount;
        trade.platformFee = platformFee;
        trade.status = TradeStatus.FUNDED;
        trade.createdAt = block.timestamp;
        trade.fundedAt = block.timestamp;

        emit TradeFunded(
            tradeId,
            buyer,
            supplier,
            logistics,
            token,
            totalRequired,
            generatedDepositAddress,
            detailsHash,
            intentTxHash
        );
    }

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function confirmDelivery(bytes32 tradeId) external override nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.status == TradeStatus.NONE) {
            revert TradeNotFound(tradeId);
        }
        if (trade.status != TradeStatus.FUNDED) {
            revert InvalidTradeStatus(tradeId, trade.status, TradeStatus.FUNDED);
        }

        address caller = _msgSender();
        if (caller != trade.buyer && caller != owner()) {
            revert UnauthorizedCaller(caller);
        }

        trade.status = TradeStatus.COMPLETED;

        // Credit internal withdrawable balances (Pull-over-Push Vault Pattern)
        if (trade.goodsAmount > 0) {
            withdrawableBalances[trade.supplier][trade.token] += trade.goodsAmount;
            emit FundsCredited(tradeId, trade.supplier, trade.token, trade.goodsAmount);
        }

        if (trade.logisticsAmount > 0) {
            address logisticsRecipient = trade.logistics != address(0) ? trade.logistics : treasury;
            withdrawableBalances[logisticsRecipient][trade.token] += trade.logisticsAmount;
            emit FundsCredited(tradeId, logisticsRecipient, trade.token, trade.logisticsAmount);
        }

        if (trade.platformFee > 0) {
            withdrawableBalances[treasury][trade.token] += trade.platformFee;
            emit FundsCredited(tradeId, treasury, trade.token, trade.platformFee);
        }

        emit DeliveryConfirmed(tradeId, caller);
    }

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function withdraw(address token) public override nonReentrant {
        address account = _msgSender();
        uint256 amount = withdrawableBalances[account][token];
        if (amount == 0) {
            revert NoWithdrawableBalance();
        }

        // Checks-Effects-Interactions (CEI)
        withdrawableBalances[account][token] = 0;

        if (token == address(0)) {
            Address.sendValue(payable(account), amount);
        } else {
            IERC20(token).safeTransfer(account, amount);
        }

        emit Withdrawn(account, token, amount);
    }

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function withdrawETH() external override {
        withdraw(address(0));
    }

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function raiseDispute(bytes32 tradeId) external override {
        Trade storage trade = trades[tradeId];
        if (trade.status == TradeStatus.NONE) {
            revert TradeNotFound(tradeId);
        }
        if (trade.status != TradeStatus.FUNDED) {
            revert InvalidTradeStatus(tradeId, trade.status, TradeStatus.FUNDED);
        }

        address caller = _msgSender();
        if (caller != trade.buyer && caller != owner()) {
            revert UnauthorizedCaller(caller);
        }

        trade.status = TradeStatus.DISPUTED;
        emit TradeDisputed(tradeId, caller);
    }

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function refundBuyer(bytes32 tradeId) external override onlyOwner nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.status == TradeStatus.NONE) {
            revert TradeNotFound(tradeId);
        }
        if (trade.status != TradeStatus.DISPUTED && trade.status != TradeStatus.FUNDED) {
            revert InvalidTradeStatus(tradeId, trade.status, TradeStatus.DISPUTED);
        }

        trade.status = TradeStatus.REFUNDED;

        uint256 refundAmount = trade.goodsAmount + trade.logisticsAmount + trade.platformFee;

        // Credit buyer's withdrawable balance for safe pull-pattern withdrawal
        withdrawableBalances[trade.buyer][trade.token] += refundAmount;

        emit BuyerRefunded(tradeId, trade.buyer, refundAmount);
        emit FundsCredited(tradeId, trade.buyer, trade.token, refundAmount);
    }

    // --- View Functions ---

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function getTrade(bytes32 tradeId) external view override returns (Trade memory) {
        return trades[tradeId];
    }

    /**
     * @inheritdoc IAgriFlowEscrow
     */
    function getWithdrawableBalance(address user, address token) external view override returns (uint256) {
        return withdrawableBalances[user][token];
    }
}
