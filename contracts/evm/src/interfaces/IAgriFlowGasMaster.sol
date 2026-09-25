// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAgriFlowGasMaster
 * @notice Interface for the AgriFlow Gasless Meta-Transaction Paymaster & Trusted Forwarder.
 * @dev Compliant with EIP-712 typed signature verification and ERC-2771 context forwarding.
 */
interface IAgriFlowGasMaster {
    /**
     * @notice ForwardRequest struct matching EIP-712 definition.
     * @param from Signer/User address requesting the transaction execution.
     * @param to Destination contract target (e.g. AgriFlowEscrow).
     * @param value Native token value attached to the forwarded call.
     * @param gas Minimum gas limit forwarded to the destination call.
     * @param nonce Nonce of the signer to prevent replays.
     * @param deadline Unix timestamp after which the request is invalid.
     * @param data Encoded calldata to be executed on target.
     */
    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        uint256 deadline;
        bytes data;
    }

    // --- Events ---

    /**
     * @notice Emitted when a meta-transaction is executed through GasMaster.
     */
    event TransactionExecuted(
        address indexed from,
        address indexed to,
        uint256 nonce,
        bool success,
        bytes returnData
    );

    /**
     * @notice Emitted when a target contract's whitelist status is updated.
     */
    event TargetWhitelisted(address indexed target, bool approved);

    /**
     * @notice Emitted when the gas tank is funded.
     */
    event GasTankFunded(address indexed sender, uint256 amount);

    /**
     * @notice Emitted when funds are withdrawn from the gas tank.
     */
    event GasTankWithdrawn(address indexed recipient, uint256 amount);

    /**
     * @notice Emitted when a relayer is reimbursed for gas spent from the gas tank.
     */
    event GasRefundPaid(address indexed relayer, uint256 refundAmount);

    /**
     * @notice Emitted when rate limiting cooldown is updated.
     */
    event RateLimitCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    /**
     * @notice Emitted when maximum forward gas limit is updated.
     */
    event MaxGasLimitUpdated(uint256 oldLimit, uint256 newLimit);

    /**
     * @notice Emitted when relayer gas refund parameters are modified.
     */
    event RelayerRefundConfigUpdated(bool enabled, uint256 maxRefundGasPrice);

    // --- Custom Errors ---

    error GasMasterInvalidSigner(address recovered, address expected);
    error GasMasterInvalidNonce(uint256 provided, uint256 current);
    error GasMasterRequestExpired(uint256 deadline, uint256 currentTimestamp);
    error GasMasterTargetNotWhitelisted(address target);
    error GasMasterInsufficientGas(uint256 providedGas, uint256 requiredGas);
    error GasMasterGasLimitExceeded(uint256 requestedGas, uint256 maxGasLimit);
    error GasMasterRateLimitExceeded(address from, uint256 nextAllowedTimestamp);
    error GasMasterCallFailed(bytes returnData);
    error GasMasterInsufficientTankBalance(uint256 required, uint256 available);
    error GasMasterInvalidArrayLength();
    error GasMasterZeroAddress();

    // --- Core Functions ---

    /**
     * @notice Verifies whether a forward request has a valid signature, nonce, deadline, and target.
     * @param req The forward request details.
     * @param signature The EIP-712 signature from req.from.
     * @return isValid True if the request is valid and executable.
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) external view returns (bool isValid);

    /**
     * @notice Executes a forward request on behalf of the signer.
     * @param req The forward request details.
     * @param signature The EIP-712 signature from req.from.
     * @return success True if the call to the target succeeded.
     * @return returnData Return data from the forwarded call.
     */
    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) external payable returns (bool success, bytes memory returnData);

    /**
     * @notice Executes a forward request without reverting if the destination call fails.
     * Nonce is still consumed and TransactionExecuted is emitted.
     * @param req The forward request details.
     * @param signature The EIP-712 signature from req.from.
     * @return success True if the destination call succeeded.
     * @return returnData Return data from the forwarded call.
     */
    function tryExecute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) external payable returns (bool success, bytes memory returnData);

    /**
     * @notice Batch execution of multiple forward requests.
     * @param requests Array of forward requests.
     * @param signatures Array of corresponding EIP-712 signatures.
     * @return successes Array of booleans indicating success for each call.
     */
    function executeBatch(
        ForwardRequest[] calldata requests,
        bytes[] calldata signatures
    ) external payable returns (bool[] memory successes);

    /**
     * @notice Gets the current nonce for a user.
     * @param user The address of the user.
     * @return Current nonce.
     */
    function getNonce(address user) external view returns (uint256);

    /**
     * @notice Checks if a target contract is whitelisted.
     * @param target Address of the target contract.
     * @return True if approved.
     */
    function isWhitelisted(address target) external view returns (bool);

    /**
     * @notice Returns current balance of the pre-funded gas tank.
     */
    function getGasTankBalance() external view returns (uint256);
}
