// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IAgriFlowGasMaster} from "./interfaces/IAgriFlowGasMaster.sol";

/**
 * @title AgriFlowGasMaster
 * @notice Trusted Forwarder & Gasless Meta-Transaction Paymaster for the AgriFlow Platform.
 * @dev Sponsoring gas fees for buyers confirming orders, suppliers and haulers withdrawing funds.
 * Complies with EIP-712 typed signature verification and ERC-2771 calldata context resolution.
 */
contract AgriFlowGasMaster is IAgriFlowGasMaster, EIP712, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    /// @dev EIP-712 TypeHash for ForwardRequest
    bytes32 public constant FORWARD_REQUEST_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint256 deadline,bytes data)"
    );

    /// @dev Default maximum gas limit per meta-transaction
    uint256 public constant DEFAULT_MAX_GAS_LIMIT = 5_000_000;

    /// @dev Overhead gas allowance estimated for gas refund calculations
    uint256 private constant REFUND_BASE_GAS_OVERHEAD = 35_000;

    /// @notice Replay protection nonces per user address
    mapping(address => uint256) public nonces;

    /// @notice Whitelisted destination contracts (e.g. AgriFlowEscrow)
    mapping(address => bool) public isTargetWhitelisted;

    /// @notice Last timestamp when an address executed a meta-transaction (for rate-limiting)
    mapping(address => uint256) public lastExecutionTime;

    /// @notice Rate limiting cooldown duration in seconds (0 = disabled)
    uint256 public rateLimitCooldown;

    /// @notice Maximum allowed gas forwarded per meta-transaction
    uint256 public maxGasLimit;

    /// @notice Flag enabling gas refunds to relayers from the pre-funded gas tank
    bool public gasRefundEnabled;

    /// @notice Maximum gas price (in wei) subsidized when reimbursing relayers
    uint256 public maxRefundGasPrice;

    /**
     * @notice Constructor initializing EIP-712 domain, ownership, and approved targets.
     * @param initialOwner Treasury or admin address controlling the GasMaster.
     * @param initialTargets Initial destination contracts to whitelist (e.g. AgriFlowEscrow).
     */
    constructor(
        address initialOwner,
        address[] memory initialTargets
    ) EIP712("AgriFlowGasMaster", "1") Ownable(initialOwner) {
        if (initialOwner == address(0)) revert GasMasterZeroAddress();

        maxGasLimit = DEFAULT_MAX_GAS_LIMIT;
        maxRefundGasPrice = 100 gwei;

        for (uint256 i = 0; i < initialTargets.length; ++i) {
            address target = initialTargets[i];
            if (target != address(0)) {
                isTargetWhitelisted[target] = true;
                emit TargetWhitelisted(target, true);
            }
        }
    }

    // --- Fallback & Gas Tank Funding ---

    /**
     * @notice Accepts direct native token deposits into the GasMaster gas tank.
     */
    receive() external payable {
        emit GasTankFunded(msg.sender, msg.value);
    }

    /**
     * @notice Fallback function accepting native token deposits.
     */
    fallback() external payable {
        emit GasTankFunded(msg.sender, msg.value);
    }

    /**
     * @notice Explicit method to fund the GasMaster gas tank.
     */
    function depositGasTank() external payable {
        emit GasTankFunded(msg.sender, msg.value);
    }

    /**
     * @notice Withdraws native funds from the gas tank to an authorized recipient.
     * @dev Only callable by the AgriFlow Treasury / Owner.
     * @param to Destination address.
     * @param amount Amount of native currency in wei to withdraw.
     */
    function withdrawGasTank(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert GasMasterZeroAddress();
        if (amount > address(this).balance) {
            revert GasMasterInsufficientTankBalance(amount, address(this).balance);
        }

        Address.sendValue(to, amount);
        emit GasTankWithdrawn(to, amount);
    }

    // --- Admin Configuration ---

    /**
     * @notice Whitelists or removes a destination contract target.
     * @param target Address of the destination contract.
     * @param approved True to allow calls to this target, false to disallow.
     */
    function setTargetWhitelist(address target, bool approved) external onlyOwner {
        if (target == address(0)) revert GasMasterZeroAddress();
        isTargetWhitelisted[target] = approved;
        emit TargetWhitelisted(target, approved);
    }

    /**
     * @notice Batch whitelisting of destination contract targets.
     * @param targets Array of contract addresses.
     * @param approved True to approve all, false to revoke.
     */
    function setTargetBatchWhitelist(address[] calldata targets, bool approved) external onlyOwner {
        for (uint256 i = 0; i < targets.length; ++i) {
            address target = targets[i];
            if (target == address(0)) revert GasMasterZeroAddress();
            isTargetWhitelisted[target] = approved;
            emit TargetWhitelisted(target, approved);
        }
    }

    /**
     * @notice Sets rate-limiting cooldown between meta-transactions per user.
     * @param newCooldown Cooldown in seconds (0 = disabled).
     */
    function setRateLimitCooldown(uint256 newCooldown) external onlyOwner {
        uint256 old = rateLimitCooldown;
        rateLimitCooldown = newCooldown;
        emit RateLimitCooldownUpdated(old, newCooldown);
    }

    /**
     * @notice Updates the maximum gas limit permitted per meta-transaction.
     * @param newMaxGasLimit Gas ceiling.
     */
    function setMaxGasLimit(uint256 newMaxGasLimit) external onlyOwner {
        uint256 old = maxGasLimit;
        maxGasLimit = newMaxGasLimit;
        emit MaxGasLimitUpdated(old, newMaxGasLimit);
    }

    /**
     * @notice Configures automatic relayer gas refund parameters.
     * @param enabled Whether to refund relayer gas expenditure from the gas tank.
     * @param maxGasPrice Maximum subsidized gas price ceiling.
     */
    function setRelayerRefundConfig(bool enabled, uint256 maxGasPrice) external onlyOwner {
        gasRefundEnabled = enabled;
        maxRefundGasPrice = maxGasPrice;
        emit RelayerRefundConfigUpdated(enabled, maxGasPrice);
    }

    // --- View Functions ---

    /**
     * @inheritdoc IAgriFlowGasMaster
     */
    function getNonce(address user) external view override returns (uint256) {
        return nonces[user];
    }

    /**
     * @inheritdoc IAgriFlowGasMaster
     */
    function isWhitelisted(address target) external view override returns (bool) {
        return isTargetWhitelisted[target];
    }

    /**
     * @inheritdoc IAgriFlowGasMaster
     */
    function getGasTankBalance() external view override returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Computes the EIP-712 hash for a given ForwardRequest.
     * @param req The forward request.
     * @return EIP-712 typed data digest.
     */
    function hashForwardRequest(ForwardRequest calldata req) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
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
            )
        );
    }

    /**
     * @inheritdoc IAgriFlowGasMaster
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) public view override returns (bool) {
        if (block.timestamp > req.deadline) {
            return false;
        }

        if (req.nonce != nonces[req.from]) {
            return false;
        }

        if (!isTargetWhitelisted[req.to]) {
            return false;
        }

        if (req.gas > maxGasLimit) {
            return false;
        }

        if (rateLimitCooldown > 0 && block.timestamp < lastExecutionTime[req.from] + rateLimitCooldown) {
            return false;
        }

        bytes32 digest = hashForwardRequest(req);
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != req.from || recovered == address(0)) {
            return false;
        }

        return true;
    }

    // --- Meta-Transaction Execution ---

    /**
     * @inheritdoc IAgriFlowGasMaster
     * @dev Executes a validated forward request. Reverts if the destination call reverts.
     */
    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) external payable override nonReentrant returns (bool success, bytes memory returnData) {
        uint256 gasStart = gasleft();

        _validateRequest(req, signature);

        // State update: consume nonce and record rate limit
        nonces[req.from] = req.nonce + 1;
        lastExecutionTime[req.from] = block.timestamp;

        // Execute call with ERC-2771 context appended
        (success, returnData) = _forwardCall(req);

        if (!success) {
            _bubbleUpRevert(returnData);
        }

        emit TransactionExecuted(req.from, req.to, req.nonce, true, returnData);

        _handleRelayerRefund(gasStart);

        return (true, returnData);
    }

    /**
     * @inheritdoc IAgriFlowGasMaster
     * @dev Executes a validated forward request without reverting outer tx on destination failure.
     */
    function tryExecute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) external payable override nonReentrant returns (bool success, bytes memory returnData) {
        uint256 gasStart = gasleft();

        _validateRequest(req, signature);

        // State update: consume nonce and record rate limit
        nonces[req.from] = req.nonce + 1;
        lastExecutionTime[req.from] = block.timestamp;

        // Execute call with ERC-2771 context appended
        (success, returnData) = _forwardCall(req);

        emit TransactionExecuted(req.from, req.to, req.nonce, success, returnData);

        _handleRelayerRefund(gasStart);

        return (success, returnData);
    }

    /**
     * @inheritdoc IAgriFlowGasMaster
     */
    function executeBatch(
        ForwardRequest[] calldata requests,
        bytes[] calldata signatures
    ) external payable override nonReentrant returns (bool[] memory successes) {
        if (requests.length != signatures.length) {
            revert GasMasterInvalidArrayLength();
        }

        uint256 gasStart = gasleft();
        uint256 count = requests.length;
        successes = new bool[](count);

        for (uint256 i = 0; i < count; ++i) {
            ForwardRequest calldata req = requests[i];
            bytes calldata signature = signatures[i];

            if (!verify(req, signature)) {
                successes[i] = false;
                continue;
            }

            nonces[req.from] = req.nonce + 1;
            lastExecutionTime[req.from] = block.timestamp;

            (bool callSuccess, bytes memory returnData) = _forwardCall(req);
            successes[i] = callSuccess;

            emit TransactionExecuted(req.from, req.to, req.nonce, callSuccess, returnData);
        }

        _handleRelayerRefund(gasStart);

        return successes;
    }

    // --- Internal Helpers ---

    /**
     * @dev Validates request deadline, nonce, target whitelist, gas limit, rate limits, and EIP-712 signature.
     */
    function _validateRequest(ForwardRequest calldata req, bytes calldata signature) internal view {
        if (block.timestamp > req.deadline) {
            revert GasMasterRequestExpired(req.deadline, block.timestamp);
        }

        if (req.nonce != nonces[req.from]) {
            revert GasMasterInvalidNonce(req.nonce, nonces[req.from]);
        }

        if (!isTargetWhitelisted[req.to]) {
            revert GasMasterTargetNotWhitelisted(req.to);
        }

        if (req.gas > maxGasLimit) {
            revert GasMasterGasLimitExceeded(req.gas, maxGasLimit);
        }

        if (rateLimitCooldown > 0) {
            uint256 nextAllowed = lastExecutionTime[req.from] + rateLimitCooldown;
            if (block.timestamp < nextAllowed) {
                revert GasMasterRateLimitExceeded(req.from, nextAllowed);
            }
        }

        // Verify available gas: account for 63/64 EVM call rule
        if (gasleft() < req.gas + (req.gas / 63)) {
            revert GasMasterInsufficientGas(gasleft(), req.gas);
        }

        // Verify signature
        bytes32 digest = hashForwardRequest(req);
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != req.from || recovered == address(0)) {
            revert GasMasterInvalidSigner(recovered, req.from);
        }
    }

    /**
     * @dev Appends `req.from` (20 bytes) to the calldata in accordance with ERC-2771 and performs call.
     */
    function _forwardCall(
        ForwardRequest calldata req
    ) internal returns (bool success, bytes memory returnData) {
        // Ensure sufficient balance exists to fulfill value (either from msg.value or gas tank)
        if (req.value > 0 && address(this).balance < req.value) {
            revert GasMasterInsufficientTankBalance(req.value, address(this).balance);
        }

        // ERC-2771: append original sender address to calldata
        bytes memory callData = abi.encodePacked(req.data, req.from);

        (success, returnData) = req.to.call{gas: req.gas, value: req.value}(callData);
    }

    /**
     * @dev Reverts with the exact reason returned from target call.
     */
    function _bubbleUpRevert(bytes memory returnData) internal pure {
        if (returnData.length > 0) {
            assembly ("memory-safe") {
                revert(add(32, returnData), mload(returnData))
            }
        } else {
            revert GasMasterCallFailed(returnData);
        }
    }

    /**
     * @dev Reimburses relayer (msg.sender) from the pre-funded gas tank if feature is enabled.
     */
    function _handleRelayerRefund(uint256 gasStart) internal {
        if (!gasRefundEnabled) return;

        uint256 availableBalance = address(this).balance;
        if (availableBalance == 0) return;

        uint256 gasSpent = gasStart - gasleft() + REFUND_BASE_GAS_OVERHEAD;
        uint256 effectiveGasPrice = tx.gasprice > maxRefundGasPrice ? maxRefundGasPrice : tx.gasprice;
        uint256 refundAmount = gasSpent * effectiveGasPrice;

        if (refundAmount > availableBalance) {
            refundAmount = availableBalance;
        }

        if (refundAmount > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: refundAmount}("");
            if (refunded) {
                emit GasRefundPaid(msg.sender, refundAmount);
            }
        }
    }
}
