import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { FreighterBanner } from '../components/ui/FreighterBanner';
import { transactionService } from '../services/transactionService';
import { logisticsService } from '../services/logisticsService';
import { formatCommodity, formatCurrency } from '../utils/format';
import type { Transaction } from '../types';
import {
  connectWallet,
  getWalletKey,
  releaseEscrowOnChain,
  stellarExpertLink,
} from '../lib/stellar';

export function ConfirmReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [qtyChecked, setQtyChecked] = useState(true);
  const [qualityChecked, setQualityChecked] = useState(true);
  const [undamagedChecked, setUndamagedChecked] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [releaseTxHash, setReleaseTxHash] = useState<string | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const targetId = id;
    let isMounted = true;
    async function load() {
      const t = await transactionService.fetchById(targetId);
      if (isMounted && t) {
        setTx(t);
        if (t.status === 'COMPLETED') setCompleted(true);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [id]);

  const canConfirm = qtyChecked && qualityChecked && undamagedChecked;

  const handleConfirmRelease = async () => {
    if (!session || !canConfirm || !tx) return;
    const txId = tx.id;
    setReleaseError(null);
    setIsReleasing(true);
    try {
      let pubKey = await getWalletKey();
      if (!pubKey) pubKey = await connectWallet();

      const hash = await releaseEscrowOnChain({ txId, buyerPublicKey: pubKey });
      setReleaseTxHash(hash);

      await transactionService.transition({
        transactionId: txId,
        to: 'COMPLETED',
        actorId: session.userId,
        actorName: session.name,
        actorRole: 'buyer',
        note: `Buyer confirmed receipt. Escrow funds released. Tx: ${hash}`,
      });

      // Synchronize logistics job status
      const job = logisticsService.getForTransaction(txId) || (tx.logisticsJobId ? logisticsService.getById(tx.logisticsJobId) : null);
      if (job) {
        await logisticsService.updateJobStatus({
          jobId: job.id,
          status: 'COMPLETED',
          providerId: job.providerId || session.userId,
          providerName: job.providerName || session.name,
        }).catch(() => {});
      }

      setCompleted(true);
      const updatedTx = await transactionService.fetchById(txId);
      if (updatedTx) setTx(updatedTx);
      toast('success', `Receipt confirmed! Escrow funds released and transaction completed.`);
    } catch (err: unknown) {
      setReleaseError(err instanceof Error ? err.message : 'Escrow release failed. Please try again.');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleReportIssue = () => {
    toast('info', 'Redirecting to dispute resolution center...');
    navigate('/app/admin/disputes');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <FreighterBanner />

      {releaseError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{releaseError}</p>
        </div>
      )}

      {completed && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-900">
          <CheckCircle2 className="w-5 h-5 mt-0.5 text-green-700 shrink-0" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-green-900 text-sm">Receipt Confirmed & Escrow Released</p>
            <p className="text-green-800">
              This transaction is completed. Escrow funds have been successfully released to the supplier and carrier.
            </p>
          </div>
        </div>
      )}

      {/* Back Link */}
      <div>
        <Link
          to={`/app/transactions/${tx?.id || id || ''}`}
          className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          ← Back to Transaction Details
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Confirm receipt</h1>
          <p className="text-xs text-gray-500 mt-1">
            {tx ? `${tx.id} · ${formatCommodity(tx.commodity)} · Supplier: ${tx.supplierName}` : (id || 'TXN-AGF')}
          </p>
        </div>
        <div>
          <span className={`status-pill ${completed ? 'status-pill-green' : 'status-pill-purple'}`}>
            {completed ? 'COMPLETED' : (tx?.status || 'BUYER_CONFIRMATION_PENDING')}
          </span>
        </div>
      </div>

      {/* Alert Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 text-xs text-gray-700 flex items-start gap-2">
        <span className="text-gray-900 font-bold">ℹ</span>
        <span>
          Confirming receipt releases USDC funds to the supplier and logistics provider from the Soroban escrow contract and closes this transaction.
          Check the goods before you confirm.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: What was delivered & Checklist */}
        <div className="lg:col-span-2 space-y-4">
          {/* What was delivered */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              What was delivered
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-gray-500">Commodity</div>
                <div className="font-semibold text-gray-900 mt-0.5">{tx ? `${formatCommodity(tx.commodity)} · Grade ${tx.qualityGrade}` : 'Maize'}</div>
              </div>
              <div>
                <div className="text-gray-500">Quantity ordered</div>
                <div className="font-semibold text-gray-900 mt-0.5">{tx ? `${tx.quantity} ${tx.unit}` : '12 tonnes'}</div>
              </div>
              <div>
                <div className="text-gray-500">Quantity delivered</div>
                <div className="font-semibold text-gray-900 mt-0.5">{tx ? `${tx.quantity} ${tx.unit}` : '12 tonnes'}</div>
              </div>
              <div>
                <div className="text-gray-500">Delivery Location</div>
                <div className="font-semibold text-gray-900 mt-0.5">{tx ? tx.deliveryLocation : 'Lagos, Nigeria'}</div>
              </div>
            </div>

            {/* Proof of delivery photos */}
            <div className="pt-2">
              <div className="text-xs font-medium text-gray-700 mb-2">Proof of delivery</div>
              <div className="grid grid-cols-4 gap-2">
                <div className="h-20 bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-lg">📄</span>
                  <span className="text-[10px] text-gray-600 mt-1 font-medium">Waybill #8871</span>
                </div>
                <div className="h-20 bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-lg">📦</span>
                  <span className="text-[10px] text-gray-600 mt-1 font-medium">Grain Sacks</span>
                </div>
                <div className="h-20 bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-lg">⚖️</span>
                  <span className="text-[10px] text-gray-600 mt-1 font-medium">Scale Ticket</span>
                </div>
                <div className="h-20 bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-lg">✍️</span>
                  <span className="text-[10px] text-gray-600 mt-1 font-medium">Depot Signoff</span>
                </div>
              </div>
            </div>
          </div>

          {/* Before you confirm checklist */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Before you confirm
            </h2>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qtyChecked}
                  onChange={(e) => setQtyChecked(e.target.checked)}
                  className="mt-0.5 accent-agri-700 w-4 h-4 rounded"
                />
                <div>
                  <div className="font-semibold text-gray-900">Quantity matches the order</div>
                  <div className="text-gray-500">12 tonnes received</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qualityChecked}
                  onChange={(e) => setQualityChecked(e.target.checked)}
                  className="mt-0.5 accent-agri-700 w-4 h-4 rounded"
                />
                <div>
                  <div className="font-semibold text-gray-900">Quality matches the agreed grade</div>
                  <div className="text-gray-500">Grade A</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={undamagedChecked}
                  onChange={(e) => setUndamagedChecked(e.target.checked)}
                  className="mt-0.5 accent-agri-700 w-4 h-4 rounded"
                />
                <div>
                  <div className="font-semibold text-gray-900">Goods are undamaged</div>
                  <div className="text-gray-500">No visible damage on arrival</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Release Breakdown & Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Payment release
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Held in Soroban escrow</span>
                <span className="font-medium text-gray-900">{formatCurrency(tx ? tx.totalAmount + Math.round(tx.totalAmount * 0.03) : 0, tx?.currency)} (USDC)</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Released to supplier</span>
                <span className="font-medium text-gray-900">{formatCurrency(tx ? tx.totalAmount : 0, tx?.currency)} (USDC)</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Released to logistics</span>
                <span className="font-medium text-gray-900">{formatCurrency(tx ? Math.round(tx.totalAmount * 0.03) : 0, tx?.currency)} (USDC)</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total released</span>
                <span>{formatCurrency(tx ? tx.totalAmount + Math.round(tx.totalAmount * 0.03) : 0, tx?.currency)} (USDC)</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={!canConfirm || isReleasing || completed}
                onClick={handleConfirmRelease}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-agri-700 hover:bg-agri-800 rounded-lg transition-colors shadow-xs disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                {isReleasing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Releasing Escrow on Chain...
                  </>
                ) : completed ? (
                  '✓ Receipt Confirmed & Escrow Released'
                ) : (
                  'Confirm receipt & Release Escrow'
                )}
              </button>
              {releaseTxHash && (
                <a
                  href={stellarExpertLink(releaseTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs text-blue-600 underline mt-2"
                >
                  View release on Stellar Expert ↗
                </a>
              )}
              <button
                type="button"
                onClick={handleReportIssue}
                className="w-full py-2.5 px-4 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
              >
                Report an issue instead
              </button>
            </div>
          </div>

          {/* If Something Is Wrong Notice */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-2">
            <h3 className="text-xs font-semibold text-gray-700">If something is wrong</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Reporting an issue moves this transaction to DISPUTED and holds the escrow funds on-chain.
              AgriFlow Operations reviews the evidence and records a decision.
            </p>
          </div>
        </div>
      </div>

      {releaseTxHash && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-900">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">Escrow released on Stellar Testnet</p>
            <a
              href={stellarExpertLink(releaseTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-green-800 underline underline-offset-2 break-all font-mono"
            >
              {stellarExpertLink(releaseTxHash)}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}