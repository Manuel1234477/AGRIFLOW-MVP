import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { FreighterBanner } from '../components/ui/FreighterBanner';
import { transactionService } from '../services/transactionService';
import { paymentService } from '../services/paymentService';
import {
  CONTRACT_ID,
  connectWallet,
  getWalletKey,
  createAndDepositEscrow,
  mintTestnetUsdc,
  stellarExpertLink,
} from '../lib/stellar';
import { formatCommodity, formatCurrency } from '../utils/format';
import type { Transaction } from '../types';

export const USDC_RATE = 1350; // 1 USDC = ₦1,350

export function CompletePaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'card' | 'stellar'>('stellar');
  const [paying, setPaying] = useState(false);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [walletKey, setWalletKey] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const targetId = id;
    let isMounted = true;
    async function load() {
      const transaction = await transactionService.fetchById(targetId);
      if (isMounted && transaction) {
        setTx(transaction);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [id]);

  useEffect(() => {
    getWalletKey()
      .then(setWalletKey)
      .catch(() => setWalletKey(null));
  }, []);

  // Compute values using 1 USDC = 1,350 NGN rate
  const rawAmount = tx ? (tx.totalAmount || (tx.quantity * tx.pricePerUnit)) : 5760000;
  const isUsdcTx = tx?.currency === 'USDC';
  const goodsSubtotalNgn = isUsdcTx ? Math.round(rawAmount * USDC_RATE) : rawAmount;
  const goodsSubtotalUsdc = isUsdcTx ? rawAmount : Number((goodsSubtotalNgn / USDC_RATE).toFixed(2));

  const logisticsCostNgn = Math.round(goodsSubtotalNgn * 0.035);
  const logisticsCostUsdc = Number((logisticsCostNgn / USDC_RATE).toFixed(2));

  const platformFeeNgn = Math.round(goodsSubtotalNgn * 0.01);
  const platformFeeUsdc = Number((platformFeeNgn / USDC_RATE).toFixed(2));

  const totalDueNgn = goodsSubtotalNgn + logisticsCostNgn + platformFeeNgn;
  const totalDueUsdc = Number((totalDueNgn / USDC_RATE).toFixed(2));

  const handlePay = async () => {
    if (!session || !tx) return;
    setPaying(true);
    setErrorMessage(null);
    try {
      // 1. Initiate payment record
      const payment = await paymentService.initiate({
        transactionId: tx.id,
        payerId: session.userId,
        payerName: session.name,
        amount: totalDueNgn,
        currency: 'NGN',
      });

      // 2. Confirm payment to advance state (advances to PAYMENT_CONFIRMED & creates logistics job)
      await paymentService.confirm(payment.id, session.userId, session.name);

      toast('success', `Payment of ${formatCurrency(totalDueNgn, 'NGN')} confirmed and secured in escrow.`);
      navigate(`/app/transactions/${tx.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment processing failed.';
      setErrorMessage(msg);
      toast('error', msg);
    } finally {
      setPaying(false);
    }
  };

  const handleConnectWallet = async () => {
    setErrorMessage(null);
    try {
      const pk = await connectWallet();
      setWalletKey(pk);
      toast('success', 'Freighter wallet connected.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect Freighter.');
    }
  };

  const handleMintUsdc = async () => {
    if (!walletKey) {
      try {
        const pk = await connectWallet();
        setWalletKey(pk);
      } catch {
        return;
      }
    }
    const targetKey = walletKey;
    if (!targetKey) return;
    setIsMinting(true);
    try {
      const hash = await mintTestnetUsdc(targetKey, 10000);
      toast('success', `Minted 10,000 Testnet USDC to ${truncateKey(targetKey)}! Tx: ${hash.slice(0, 8)}…`);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Minting Testnet USDC failed.');
    } finally {
      setIsMinting(false);
    }
  };

  const handlePayStellar = async () => {
    if (!tx || !session) return;
    const txId = tx.id;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const pubKey = walletKey ?? (await connectWallet());
      setWalletKey(pubKey);

      const hash = await createAndDepositEscrow({
        txId,
        buyerPublicKey: pubKey,
        supplierPublicKey: (tx as { supplierWallet?: string }).supplierWallet || undefined,
        logisticsPublicKey: (tx as { logisticsWallet?: string }).logisticsWallet || undefined,
        goodsAmount: goodsSubtotalUsdc,
        logisticsAmount: logisticsCostUsdc,
      });
      setTxHash(hash);

      const payment = await paymentService.initiate({
        transactionId: txId,
        payerId: session.userId,
        payerName: session.name,
        amount: totalDueUsdc,
        currency: 'USDC',
      });
      await paymentService.confirm(payment.id, session.userId, session.name);

      toast('success', `Escrow deposit confirmed on Stellar Testnet.`);
      setTimeout(() => navigate(`/app/transactions/${txId}`), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stellar payment failed. Please try again.';
      setErrorMessage(msg);
      toast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyPaid =
    tx &&
    tx.status !== 'PAYMENT_PENDING' &&
    tx.status !== 'ACCEPTED' &&
    tx.status !== 'PENDING';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <FreighterBanner />

      {isAlreadyPaid && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-900">Escrow Payment Confirmed</div>
              <div className="text-xs text-emerald-700">
                Payment has already been confirmed and funds are secured in escrow.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/app/transactions/${tx?.id}`)}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer whitespace-nowrap"
          >
            View Transaction & Tracking →
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Back Link */}
      <div>
        <Link
          to="/app/dashboard"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Complete payment</h1>
        <p className="text-xs text-gray-500 mt-1">
          {tx?.id || 'TXN-4821'} · Supplier accepted · Demand D-1043
        </p>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-700 border border-gray-200">
          ✓ ACCEPTED
        </span>
        <span className="text-gray-400">—</span>
        <span className="px-2.5 py-1 rounded-full font-medium bg-gray-900 text-white">
          PAYMENT_PENDING
        </span>
        <span className="text-gray-400">—</span>
        <span className="px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-400">
          LOGISTICS_ASSIGNED
        </span>
        <span className="text-gray-400">—</span>
        <span className="px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-400">
          IN_TRANSIT
        </span>
        <span className="text-gray-400">—</span>
        <span className="px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-400">
          COMPLETED
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Payment Method Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Payment method
              </h2>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold">
                <span>1 USDC ≈ ₦1,350</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* USDC (Soroban Escrow) */}
              <label
                className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                  paymentMethod === 'stellar'
                    ? 'border-gray-800 bg-gray-50/50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="stellar"
                      checked={paymentMethod === 'stellar'}
                      onChange={() => setPaymentMethod('stellar')}
                      className="mt-0.5 accent-gray-900"
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">Pay with USDC (Soroban Escrow)</span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          {totalDueUsdc.toFixed(2)} USDC
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Escrow on Stellar Testnet · funds released on delivery confirmation
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {walletKey ? (
                          <>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-medium">
                              <span className="font-mono">{truncateKey(walletKey)}</span>
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Connected
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleMintUsdc}
                              disabled={isMinting || isSubmitting}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {isMinting ? 'Minting 10,000 USDC…' : '+ Mint 10,000 Testnet USDC'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleConnectWallet}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-agri-700 hover:bg-agri-800 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                          >
                            Connect Freighter
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    {CONTRACT_ID ? 'Testnet' : 'Unconfigured'}
                  </span>
                </div>
              </label>

              {/* Bank Transfer */}
              <label
                className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                  paymentMethod === 'bank'
                    ? 'border-gray-800 bg-gray-50/50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank"
                      checked={paymentMethod === 'bank'}
                      onChange={() => setPaymentMethod('bank')}
                      className="mt-0.5 accent-gray-900"
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-900">Bank transfer</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Pay ₦{totalDueNgn.toLocaleString()} from your bank app or internet banking
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-500">No fee</span>
                </div>
              </label>

              {/* Debit Card */}
              <label
                className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? 'border-gray-800 bg-gray-50/50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="mt-0.5 accent-gray-900"
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-900">Debit card</div>
                      <div className="text-xs text-gray-500 mt-0.5">Visa, Mastercard or Verve (₦{totalDueNgn.toLocaleString()})</div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-500">1.4% fee</span>
                </div>
              </label>
            </div>

            {/* Escrow Guarantee Notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 text-xs text-gray-600 flex items-start gap-2 mt-4">
              <span className="text-gray-700">⚑</span>
              <span>
                Funds are held by Soroban smart contract escrow and released to the supplier after you confirm receipt.
                Escrow protection is active.
              </span>
            </div>

            <div className="pt-2">
              <Link
                to={`/app/admin/disputes`}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Something wrong with this transaction? Report an issue
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Pay Action */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Order summary
            </h2>

            <div>
              <div className="text-sm font-bold text-gray-900">
                {tx ? `${formatCommodity(tx.commodity)} — Grade ${tx.qualityGrade}` : 'Agricultural Commodity'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {tx ? `${tx.quantity} ${tx.unit} · ${tx.pickupLocation} → ${tx.deliveryLocation}` : '12 tonnes'}
              </div>
            </div>

            <div className="space-y-2 text-xs pt-2 border-t border-gray-100">
              <div className="flex justify-between text-gray-600">
                <span>Goods subtotal</span>
                <span className="font-medium text-gray-900">
                  ₦{goodsSubtotalNgn.toLocaleString()} <span className="text-gray-400">({goodsSubtotalUsdc.toFixed(2)} USDC)</span>
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Logistics</span>
                <span className="font-medium text-gray-900">
                  ₦{logisticsCostNgn.toLocaleString()} <span className="text-gray-400">({logisticsCostUsdc.toFixed(2)} USDC)</span>
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Platform fee</span>
                <span className="font-medium text-gray-900">
                  ₦{platformFeeNgn.toLocaleString()} <span className="text-gray-400">({platformFeeUsdc.toFixed(2)} USDC)</span>
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total due</span>
                <div className="text-right">
                  <div>₦{totalDueNgn.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-emerald-700">{totalDueUsdc.toFixed(2)} USDC</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={paying || isSubmitting || (paymentMethod === 'stellar' && !CONTRACT_ID)}
              onClick={paymentMethod === 'stellar' ? handlePayStellar : handlePay}
              className="w-full mt-2 py-3 px-4 text-xs font-semibold text-white bg-agri-700 hover:bg-agri-800 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting
                ? 'Depositing to Soroban escrow…'
                : paying
                  ? 'Securing funds in escrow...'
                  : paymentMethod === 'stellar'
                    ? `Deposit ${totalDueUsdc.toFixed(2)} USDC into escrow (₦${totalDueNgn.toLocaleString()})`
                    : `Pay ₦${totalDueNgn.toLocaleString()}`}
            </button>

            {txHash && (
              <a
                href={stellarExpertLink(txHash)}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs text-blue-600 underline mt-2"
              >
                View transaction on Stellar Expert ↗
              </a>
            )}

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              {paymentMethod === 'stellar'
                ? 'Freighter wallet will open to approve the escrow deposit.'
                : 'You will be redirected to your payment provider. Do not close this window until payment is confirmed.'}
            </p>
          </div>
        </div>
      </div>

      {txHash && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-900">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">Escrow deposit broadcast on Stellar Testnet</p>
            <a
              href={stellarExpertLink(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-800 underline underline-offset-2 break-all font-mono"
            >
              {stellarExpertLink(txHash)}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function truncateKey(key: string): string {
  if (key.length <= 10) return key;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}