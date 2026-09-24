import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { transactionService } from '../services/transactionService';
import { paymentService } from '../services/paymentService';
import { UsdcDepositModal } from '../components/wallet/UsdcDepositModal';
import { type UsdcDepositQuote } from '../lib/nearIntents';
import { useUsdcNgnRate } from '../services/fxRateService';
import { formatCommodity } from '../utils/format';
import type { Transaction } from '../types';

export function CompletePaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const { rate: usdcRate } = useUsdcNgnRate();
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'USDC'>('CARD');
  const [paying, setPaying] = useState(false);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [isUsdcModalOpen, setIsUsdcModalOpen] = useState(false);
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
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Compute values using live CoinGecko USDC-NGN rate
  const rawAmount = tx ? tx.totalAmount || tx.quantity * tx.pricePerUnit : 5760000;
  const isUsdcTx = tx?.currency === 'USDC';
  const goodsSubtotalNgn = isUsdcTx ? Math.round(rawAmount * usdcRate) : rawAmount;
  const goodsSubtotalUsdc = isUsdcTx ? rawAmount : Number((goodsSubtotalNgn / usdcRate).toFixed(2));

  const logisticsCostNgn = Math.round(goodsSubtotalNgn * 0.035);
  const logisticsCostUsdc = Number((logisticsCostNgn / usdcRate).toFixed(2));

  const platformFeeNgn = Math.round(goodsSubtotalNgn * 0.01);
  const platformFeeUsdc = Number((platformFeeNgn / usdcRate).toFixed(2));

  const totalDueNgn = goodsSubtotalNgn + logisticsCostNgn + platformFeeNgn;
  const totalDueUsdc = Number((totalDueNgn / usdcRate).toFixed(2));

  // Handle return from Bachs Hosted Checkout. The `?payment=success` query
  // param carries no authority on its own -- a buyer could navigate
  // straight to this URL without ever paying. The backend's
  // mock_confirm_payment already refuses to confirm a Bachs-sourced
  // payment directly (409) for exactly this reason: only its
  // signature-verified webhook can settle one. So this polls for the
  // real, webhook-driven outcome instead of trusting the redirect.
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success' && tx && session) {
      const confirmBachsReturn = async () => {
        setPaying(true);
        try {
          const payment = await paymentService.pollUntilSettled(tx.id);
          if (payment?.status === 'CONFIRMED') {
            toast('success', 'Payment confirmed! Funds secured in escrow.');
          } else if (payment?.status === 'FAILED') {
            toast('error', payment.failureReason || 'Payment failed.');
          } else {
            toast('info', "Still waiting for Bachs to confirm this payment -- check back shortly.");
          }
          navigate(`/app/transactions/${tx.id}`, { replace: true });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error checking payment status.';
          toast('error', msg);
        } finally {
          setPaying(false);
        }
      };
      confirmBachsReturn();
    } else if (paymentStatus === 'cancelled') {
      toast('info', 'Checkout was cancelled.');
    }
  }, [searchParams, tx, session, navigate, toast]);

  const handlePayBachs = async () => {
    if (!session || !tx) return;
    setPaying(true);
    setErrorMessage(null);
    try {
      await paymentService.initiate({
        transactionId: tx.id,
        payerId: session.userId,
        payerName: session.name,
        amount: totalDueNgn,
        currency: 'NGN',
      });

      toast('info', 'Opening secure checkout...');

      // Session creation happens server-side now -- the API secret key
      // never reaches the browser (see src/services/paymentService.ts).
      const sessionData = await paymentService.createBachsCheckoutSession(tx.id);

      if (sessionData && sessionData.checkoutUrl) {
        window.location.href = sessionData.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout initiation failed.';
      setErrorMessage(msg);
      toast('error', msg);
      setPaying(false);
    }
  };

  const handleUsdcDepositSuccess = async (quote: UsdcDepositQuote) => {
    if (!tx || !session) return;
    const txId = tx.id;

    try {
      const payment = await paymentService.initiate({
        transactionId: txId,
        payerId: session.userId,
        payerName: session.name,
        amount: quote.amountUsdc,
        currency: 'USDC',
      });

      await paymentService.confirm(payment.id, session.userId, session.name);

      toast(
        'success',
        `USDC Escrow deposit confirmed! $${quote.amountUsdc.toFixed(2)} secured in escrow.`
      );

      setTimeout(() => {
        setIsUsdcModalOpen(false);
        navigate(`/app/transactions/${txId}`);
      }, 1200);
    } catch (err: unknown) {
      console.error('Error confirming USDC payment:', err);
      navigate(`/app/transactions/${txId}`);
    }
  };

  const isAlreadyPaid =
    tx &&
    tx.status !== 'PAYMENT_PENDING' &&
    tx.status !== 'ACCEPTED' &&
    tx.status !== 'PENDING';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
            View Transaction →
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
          {tx?.id || 'TXN-4821'} · Supplier accepted
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Payment Method Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Payment method
              </h2>
            </div>

            <div className="space-y-3">
              {/* Option 1: Card / Bank Transfer */}
              <div
                onClick={() => setPaymentMethod('CARD')}
                className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition ${
                  paymentMethod === 'CARD'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-gray-900">Secure Checkout</div>
                  <div className="text-xs text-gray-500 mt-0.5">Card, bank transfer, or USSD payment</div>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'CARD' ? 'border-blue-600' : 'border-gray-300'
                  }`}
                >
                  {paymentMethod === 'CARD' && <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                </div>
              </div>

              {/* Option 2: USDC Crypto (Multichain) */}
              <div
                onClick={() => setPaymentMethod('USDC')}
                className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition ${
                  paymentMethod === 'USDC'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <span>🌐 USDC Crypto (Multichain)</span>
                    <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold">
                      Base / ETH
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Direct on-chain payment (~${totalDueUsdc.toFixed(2)} USDC · 1 USDC ≈ ₦{usdcRate.toLocaleString()})
                  </div>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'USDC' ? 'border-blue-600' : 'border-gray-300'
                  }`}
                >
                  {paymentMethod === 'USDC' && <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                </div>
              </div>
            </div>

            {/* Escrow Notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 text-xs text-gray-600 flex items-start gap-2 mt-4">
              <span className="text-gray-700">⚑</span>
              <span>
                Funds are held in escrow and released to the supplier only after goods are inspected and confirmed.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Action */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Order summary
              </h2>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                1 USDC ≈ ₦{usdcRate.toLocaleString()}
              </div>
            </div>

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
                  ₦{goodsSubtotalNgn.toLocaleString()}{' '}
                  <span className="text-gray-400">(${goodsSubtotalUsdc.toFixed(2)} USDC)</span>
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Logistics</span>
                <span className="font-medium text-gray-900">
                  ₦{logisticsCostNgn.toLocaleString()}{' '}
                  <span className="text-gray-400">(${logisticsCostUsdc.toFixed(2)} USDC)</span>
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Platform fee</span>
                <span className="font-medium text-gray-900">
                  ₦{platformFeeNgn.toLocaleString()}{' '}
                  <span className="text-gray-400">(${platformFeeUsdc.toFixed(2)} USDC)</span>
                </span>
              </div>
              <div className="flex justify-between text-gray-500 text-[11px] pt-1">
                <span>CoinGecko FX Rate</span>
                <span className="font-mono text-gray-700">1 USDC = ₦{usdcRate.toLocaleString()} NGN</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total due</span>
                <div className="text-right">
                  <div>₦{totalDueNgn.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-emerald-700">${totalDueUsdc.toFixed(2)} USDC</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={paying}
              onClick={paymentMethod === 'USDC' ? () => setIsUsdcModalOpen(true) : handlePayBachs}
              className="w-full mt-2 py-3 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing checkout…</span>
                </>
              ) : paymentMethod === 'USDC' ? (
                <>
                  <span>Deposit ${totalDueUsdc.toFixed(2)} USDC</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Pay ₦{totalDueNgn.toLocaleString()}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Multichain USDC Deposit Modal */}
      <UsdcDepositModal
        isOpen={isUsdcModalOpen}
        onClose={() => setIsUsdcModalOpen(false)}
        exactAmountUsdc={totalDueUsdc}
        title="Fund Escrow via USDC"
        subtitle="Transfer USDC directly on Base or Ethereum to fund order escrow."
        onSuccess={handleUsdcDepositSuccess}
      />
    </div>
  );
}