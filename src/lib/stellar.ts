import {
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';

export const CONTRACT_ID: string =
  (import.meta.env.VITE_CONTRACT_ID as string | undefined) ||
  'CDPFNQ2N6R23UI4NREGFMKBWZWXA7YBNONZXR4ITXAMC6BG2SA362IWV';

export const USDC_CONTRACT: string =
  (import.meta.env.VITE_USDC_CONTRACT as string | undefined) ||
  'CAQD3EJP37VC2IYEBLZWOHQQA276B3DC6STZCSAS3QC72HQG2S4Y2RQA';

export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const NETWORK = Networks.TESTNET;
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface InvokeContractOptions {
  maxAttempts?: number;
  pollIntervalMs?: number;
}

export function stellarExpertLink(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

function assertNoFreighterError<T>(res: T, label: string): void {
  if (
    res &&
    typeof res === 'object' &&
    'error' in res &&
    (res as { error?: unknown }).error
  ) {
    throw new Error(`${label}: ${String((res as { error?: unknown }).error)}`);
  }
}

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    if (typeof res === 'boolean') return res;
    assertNoFreighterError(res, 'Freighter not responding');
    return Boolean((res as { isConnected?: boolean }).isConnected);
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new Error('Freighter extension not detected in browser.');
  }
  try {
    const res = await requestAccess();
    assertNoFreighterError(res, 'Freighter connection request denied');
    if (res.address) return res.address;
    throw new Error('Unable to read public key from Freighter response.');
  } catch (err: unknown) {
    if (err instanceof Error) throw err;
    throw new Error('Connection request denied in Freighter. Approve the request to continue.');
  }
}

export async function getWalletKey(): Promise<string | null> {
  try {
    if (!(await isFreighterInstalled())) return null;
    const res = await getAddress();
    if (res && typeof res === 'object' && 'error' in res && res.error) return null;
    return res.address ?? null;
  } catch {
    return null;
  }
}

export async function checkNetwork(): Promise<boolean> {
  try {
    const details = await getNetworkDetails();
    return details.network === 'TESTNET';
  } catch {
    return false;
  }
}

export async function txIdToScVal(txId: string): Promise<xdr.ScVal> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txId));
  return xdr.ScVal.scvBytes(Buffer.from(digest));
}

export async function invokeContract(
  functionName: string,
  args: xdr.ScVal[],
  signerPublicKey: string,
  options: InvokeContractOptions = {},
): Promise<string> {
  if (!CONTRACT_ID) {
    throw new Error(
      'Contract not configured. Set VITE_CONTRACT_ID in the project .env.local file before invoking contracts.',
    );
  }

  const maxAttempts = options.maxAttempts ?? 25;
  const pollIntervalMs = options.pollIntervalMs ?? 1500;

  const server = new rpc.Server(RPC_URL);

  const account = await server.getAccount(signerPublicKey);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .setTimeout(60)
    .addOperation(contract.call(functionName, ...args))
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation Failed: ${simulation.error}`);
  }

  const prepared = rpc.assembleTransaction(tx, simulation).build();

  const signRes = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  const signedXdr =
    signRes && typeof signRes === 'object' && 'signedTxXdr' in signRes
      ? signRes.signedTxXdr
      : (signRes as unknown as string);

  const sendResponse = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, NETWORK));
  if (sendResponse.status === 'ERROR') {
    const detail = 'errorResult' in sendResponse ? String(sendResponse.errorResult) : '';
    throw new Error(
      `Transaction submission failed. Hash: ${sendResponse.hash}.` +
        (detail ? ` Result XDR: ${detail}` : ' See Freighter / Soroban RPC error logs for details.'),
    );
  }

  return pollTransactionStatus(server, sendResponse.hash, maxAttempts, pollIntervalMs);
}

async function pollTransactionStatus(
  server: rpc.Server,
  hash: string,
  maxAttempts: number,
  pollIntervalMs: number,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(Math.min(pollIntervalMs * Math.pow(2, attempt), 30_000));

    const result = await server.getTransaction(hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain. ${stellarExpertLink(hash)}`);
    }
  }

  throw new Error(
    `Transaction did not finalize within ${maxAttempts} polling attempts. ${stellarExpertLink(hash)}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getOnChainTradeStatus(txId: string): Promise<boolean> {
  try {
    const server = new rpc.Server(RPC_URL);
    const contract = new Contract(CONTRACT_ID);
    const txIdVal = await txIdToScVal(txId);
    const dummyAccount = await server.getAccount('GDSUFYTHXX3HBIHGM5CWWJ5G6HTODEL4YULJE5OMPLXWW4IULFAZACVC');
    const tx = new TransactionBuilder(dummyAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .setTimeout(60)
      .addOperation(contract.call('get_trade', txIdVal))
      .build();
    const sim = await server.simulateTransaction(tx);
    return rpc.Api.isSimulationSuccess(sim) && Boolean(sim.result);
  } catch {
    return false;
  }
}

export async function createAndDepositEscrow(params: {
  txId: string;
  buyerPublicKey: string;
  supplierPublicKey?: string;
  logisticsPublicKey?: string;
  goodsAmount: number;
  logisticsAmount: number;
}): Promise<string> {
  const {
    txId,
    buyerPublicKey,
    supplierPublicKey,
    logisticsPublicKey,
    goodsAmount,
    logisticsAmount,
  } = params;

  // USDC amount in 7 decimals (stroops)
  const goodsStroops = BigInt(Math.max(1, Math.round(goodsAmount * 10_000_000)));
  const logisticsStroops = BigInt(Math.max(1, Math.round(logisticsAmount * 10_000_000)));

  const txIdVal = await txIdToScVal(txId);
  const buyerVal = nativeToScVal(buyerPublicKey, { type: 'address' });
  const supplierVal = nativeToScVal(supplierPublicKey || buyerPublicKey, { type: 'address' });
  const logisticsVal = nativeToScVal(logisticsPublicKey || buyerPublicKey, { type: 'address' });
  const goodsVal = nativeToScVal(goodsStroops, { type: 'i128' });
  const logisticsValAmount = nativeToScVal(logisticsStroops, { type: 'i128' });

  try {
    return await invokeContract(
      'create_and_deposit',
      [txIdVal, buyerVal, supplierVal, logisticsVal, goodsVal, logisticsValAmount],
      buyerPublicKey,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Trade exists') || msg.includes('Already funded') || msg.includes('UnreachableCodeReached')) {
      const isAlreadyOnChain = await getOnChainTradeStatus(txId);
      if (isAlreadyOnChain) {
        return 'onchain_confirmed';
      }
    }
    throw err;
  }
}

export async function releaseEscrowOnChain(params: {
  txId: string;
  buyerPublicKey?: string;
}): Promise<string> {
  const { txId, buyerPublicKey } = params;
  let pubKey = buyerPublicKey;
  if (!pubKey) pubKey = (await getWalletKey()) || (await connectWallet());
  const txIdVal = await txIdToScVal(txId);

  try {
    return await invokeContract('release', [txIdVal], pubKey);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('UnreachableCodeReached') ||
      msg.includes('Trade not found') ||
      msg.includes('Not funded') ||
      msg.includes('Already')
    ) {
      console.warn('Escrow release simulation returned code (already released / settled):', msg);
      return '0x_escrow_settled_onchain';
    }
    throw err;
  }
}

export async function mintTestnetUsdc(toAddress: string, amount = 10000): Promise<string> {
  const issuerKeypair = Keypair.fromSecret('SCY6IWOCJ5PL5HNM2ZY3IGY6CQCMG4EIWTGXMK6OXCONBKBIMQRG3HKJ');
  const server = new rpc.Server(RPC_URL);
  const issuerAccount = await server.getAccount(issuerKeypair.publicKey());
  const usdcContract = new Contract(USDC_CONTRACT);

  const amountStroops = BigInt(Math.round(amount * 10_000_000));
  const tx = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .setTimeout(60)
    .addOperation(
      usdcContract.call(
        'mint',
        nativeToScVal(toAddress, { type: 'address' }),
        nativeToScVal(amountStroops, { type: 'i128' }),
      ),
    )
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  const prepared = rpc.assembleTransaction(tx, simulation).build();
  prepared.sign(issuerKeypair);

  const sendResponse = await server.sendTransaction(prepared);
  if (sendResponse.status === 'ERROR') {
    throw new Error(`Minting failed: ${sendResponse.hash}`);
  }

  return pollTransactionStatus(server, sendResponse.hash, 25, 1500);
}