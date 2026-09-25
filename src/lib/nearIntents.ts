/**
 * NEAR Intents 1-Click API Integration for Cross-Chain USDC Escrow Deposits.
 * Docs: https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api
 * API: https://1click.chaindefuser.com/v0
 */

import deployedAddresses from '../contracts/addresses.json';

const NEAR_INTENTS_BASE = 'https://1click.chaindefuser.com/v0';

export const PLATFORM_NEAR_ADDRESS =
  (import.meta.env && import.meta.env.VITE_NEAR_PLATFORM_ADDRESS) || 'agriflow.near';

export const ESCROW_CONTRACT_ADDRESS =
  (import.meta.env && import.meta.env.VITE_AGRIFLOW_ESCROW_ADDRESS) ||
  deployedAddresses.AgriFlowEscrow ||
  '0x9E93B3ffF884b736fECEACa33d93f33aAfDdc6C5';

// On-chain / Intent API Keys
export const ONCHAIN_API_KEY =
  (import.meta.env &&
    (import.meta.env.VITE_ONCHAIN_API_KEY ||
      import.meta.env.VITE_NEAR_INTENTS_API_KEY ||
      import.meta.env.VITE_NEAR_INTENTS_JWT_TOKEN ||
      import.meta.env.VITE_NEAR_INTENTS_EXPLORER_KEY)) ||
  '';

// Supported cross-chain USDC assets (Base & Ethereum)
export const USDC_BASE = 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near';
export const USDC_ETH = 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';

export type SupportedUsdcChain = 'base' | 'ethereum';

export interface ChainInfo {
  id: SupportedUsdcChain;
  label: string;
  symbol: string;
  badge: string;
  assetId: string;
  explorerPrefix: string;
}

export const SUPPORTED_CHAINS: Record<SupportedUsdcChain, ChainInfo> = {
  base: {
    id: 'base',
    label: 'Base',
    symbol: 'BASE',
    badge: 'L2 · Lowest Fees',
    assetId: USDC_BASE,
    explorerPrefix: 'https://basescan.org/tx/',
  },
  ethereum: {
    id: 'ethereum',
    label: 'Ethereum',
    symbol: 'ETH',
    badge: 'ERC-20',
    assetId: USDC_ETH,
    explorerPrefix: 'https://etherscan.io/tx/',
  },
};

export function getNearIntentsHeaders(customKey?: string): Record<string, string> {
  const token = customKey || ONCHAIN_API_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-API-Key'] = token;
  }
  return headers;
}

export interface UsdcDepositQuote {
  quoteId: string;
  depositAddress: string;
  sourceChain: SupportedUsdcChain;
  amountUsdc: number;
  estimatedReceiveUsdc: number;
  estimatedFeeUsdc: number;
  expiresAt: string;
  correlationId?: string;
  escrowContractAddress: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

export interface DepositStatusResult {
  status: 'PENDING_DEPOSIT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'UNKNOWN';
  rawStatus: string;
  txHash?: string;
  receivedAmount?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

/**
 * Request a 1-Click USDC deposit quote directing funds to AgriFlowEscrow contract.
 */
export async function requestUsdcDepositQuote({
  amountUsdc,
  sourceChain,
  recipientContract = ESCROW_CONTRACT_ADDRESS,
  refundAddress,
}: {
  amountUsdc: number;
  sourceChain: SupportedUsdcChain;
  recipientContract?: string;
  refundAddress?: string;
}): Promise<UsdcDepositQuote> {
  const chainInfo = SUPPORTED_CHAINS[sourceChain];
  if (!chainInfo) {
    throw new Error(`Unsupported source chain: ${sourceChain}`);
  }

  const originAsset = chainInfo.assetId;
  const destinationAsset = originAsset;

  // USDC has 6 decimals
  const amountBaseUnits = Math.floor(amountUsdc * 1_000_000).toString();
  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Flow A: Direct to Smart Contract (AgriFlowEscrow)
  const quoteRequestPayload = {
    swapType: 'EXACT_INPUT',
    originAsset,
    destinationAsset,
    amount: amountBaseUnits,
    dry: false,
    slippageTolerance: 100,
    refundTo: refundAddress || recipientContract,
    refundType: 'DESTINATION_CHAIN',
    depositType: 'ORIGIN_CHAIN',
    recipient: recipientContract,
    recipientType: 'DESTINATION_CHAIN',
    deadline,
  };

  const response = await fetch(`${NEAR_INTENTS_BASE}/quote`, {
    method: 'POST',
    headers: getNearIntentsHeaders(),
    body: JSON.stringify(quoteRequestPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get deposit address (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const q = data.quote ?? data;

  const depositAddress: string = q.depositAddress ?? q.deposit_address ?? '';
  const quoteId: string = data.correlationId ?? data.correlation_id ?? q.quoteId ?? '';
  const amountInRaw: string = q.amountIn ?? q.amount_in ?? amountBaseUnits;
  const amountOutRaw: string = q.amountOut ?? q.amount_out ?? amountInRaw;
  const expiresAt: string = q.deadline ?? q.timeWhenInactive ?? deadline;

  const estimatedReceiveUsdc =
    parseFloat(q.amountOutFormatted ?? '0') || parseInt(amountOutRaw, 10) / 1_000_000;
  const estimatedFeeUsdc = Math.max(
    0,
    (parseInt(amountInRaw, 10) - parseInt(amountOutRaw, 10)) / 1_000_000
  );

  return {
    quoteId,
    depositAddress,
    sourceChain,
    amountUsdc,
    estimatedReceiveUsdc,
    estimatedFeeUsdc,
    expiresAt,
    correlationId: data.correlationId,
    escrowContractAddress: recipientContract,
    raw: data,
  };
}

/**
 * Check deposit status by deposit address or quote ID with on-chain API key authorization.
 */
export async function getUsdcDepositStatus(
  depositAddress: string
): Promise<DepositStatusResult> {
  if (!depositAddress) {
    throw new Error('Deposit address is required to check deposit status');
  }

  const url = `${NEAR_INTENTS_BASE}/status?depositAddress=${encodeURIComponent(depositAddress)}`;
  const response = await fetch(url, {
    headers: getNearIntentsHeaders(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Deposit status check failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawStatus = String(
    data.status ?? data.quote?.status ?? data.data?.status ?? data.state ?? 'UNKNOWN'
  ).toUpperCase();

  let normalizedStatus: DepositStatusResult['status'] = 'UNKNOWN';

  const completedStatuses = [
    'COMPLETED',
    'SUCCESS',
    'SETTLED',
    'EXECUTED',
    'PAID',
    'DONE',
    'REFUNDED_TO_INTENTS',
  ];
  const processingStatuses = [
    'PROCESSING',
    'DETECTED',
    'SUBMITTED',
    'KNOWN_DEPOSIT',
    'PENDING_EXECUTION',
    'IN_FLIGHT',
    'SWAP_SUBMITTED',
  ];
  const failedStatuses = ['FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED', 'REJECTED'];

  if (completedStatuses.some((s) => rawStatus.includes(s))) {
    normalizedStatus = 'COMPLETED';
  } else if (processingStatuses.some((s) => rawStatus.includes(s))) {
    normalizedStatus = 'PROCESSING';
  } else if (failedStatuses.some((s) => rawStatus.includes(s))) {
    normalizedStatus = 'FAILED';
  } else if (rawStatus.includes('PENDING') || rawStatus === 'PENDING_DEPOSIT') {
    normalizedStatus = 'PENDING_DEPOSIT';
  }

  const txHash: string | undefined =
    data.swapDetails?.nearTxHashes?.[0] ??
    data.swapDetails?.destinationChainTxHashes?.[0] ??
    data.swapDetails?.originChainTxHashes?.[0] ??
    data.txHash ??
    data.tx_hash ??
    data.transactionHash ??
    data.quote?.txHash;

  const amountFormatted =
    data.swapDetails?.amountOutFormatted ??
    data.swapDetails?.depositedAmountFormatted ??
    data.quoteResponse?.quote?.amountOutFormatted ??
    data.quote?.amountOutFormatted;

  const amountRaw =
    data.swapDetails?.amountOut ??
    data.swapDetails?.depositedAmount ??
    data.destinationAmount ??
    data.destination_amount ??
    data.amountOut ??
    data.amount_out;

  let receivedAmount: number | undefined = undefined;
  if (amountFormatted) {
    const parsed = parseFloat(String(amountFormatted));
    if (!isNaN(parsed) && parsed > 0) receivedAmount = parsed;
  } else if (amountRaw) {
    const parsed = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw));
    if (!isNaN(parsed) && parsed > 0) {
      receivedAmount = parsed > 1000 ? parsed / 1_000_000 : parsed;
    }
  }

  return {
    status: normalizedStatus,
    rawStatus,
    txHash,
    receivedAmount,
    raw: data,
  };
}
