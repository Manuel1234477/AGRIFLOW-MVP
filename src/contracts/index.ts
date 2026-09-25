import AgriFlowGasMasterAbi from './AgriFlowGasMasterAbi.json';
import AgriFlowEscrowAbi from './AgriFlowEscrowAbi.json';
import deployedAddresses from './addresses.json';

export { AgriFlowGasMasterAbi, AgriFlowEscrowAbi, deployedAddresses };
export const DEPLOYED_ADDRESSES = deployedAddresses;

export interface ForwardRequest {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: bigint;
  data: `0x${string}`;
}

export const EIP712_FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
} as const;

export const TradeStatus = {
  NONE: 0,
  FUNDED: 1,
  COMPLETED: 2,
  DISPUTED: 3,
  REFUNDED: 4,
} as const;

export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];

export interface TradeDetails {
  tradeId: `0x${string}`;
  buyer: `0x${string}`;
  supplier: `0x${string}`;
  logistics: `0x${string}`;
  token: `0x${string}`;
  generatedDepositAddress: `0x${string}`;
  detailsHash: `0x${string}`;
  intentTxHash: string;
  goodsAmount: bigint;
  logisticsAmount: bigint;
  platformFee: bigint;
  status: TradeStatus;
  createdAt: bigint;
  fundedAt: bigint;
}
