import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { transactionService } from '../services/transactionService';
import { supplyService } from '../services/supplyService';
import { formatCurrency, formatCommodity } from '../utils/format';
import type { Transaction } from '../types';

export function SupplierRequestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [acting, setActing] = useState(false);
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [listing, setListing] = useState<import('../types').SupplyListing | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      let current: Transaction | null = null;
      if (id) {
        current = await transactionService.getById(id);
      } else {
        const allSupplierTxns = await transactionService.getForSupplier(session.userId);
        current = allSupplierTxns.find((t) => t.status === 'PENDING' || t.status === 'PENDING_SUPPLIER_ACCEPTANCE') || allSupplierTxns[0] || null;
      }
      if (cancelled) return;
      setTxn(current);
      if (current?.listingId) {
        const l = await supplyService.getById(current.listingId);
        if (!cancelled) setListing(l);
      }
    })();
    return () => { cancelled = true; };
  }, [id, session]);

  const handleAccept = async () => {
    if (!session || !txn) return;
    setActing(true);
    try {
      await transactionService.transition({
        transactionId: txn.id,
        to: 'ACCEPTED',
        actorId: session.userId,
        actorName: session.name,
        actorRole: 'supplier',
        note: 'Supplier accepted the transaction request.',
      });
      setTxn({ ...txn, status: 'ACCEPTED' });
      toast('success', `Transaction request ${txn.id} accepted. Buyer notified to complete escrow payment.`);
      setTimeout(() => {
        navigate('/app/transactions');
      }, 1200);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to accept request.');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!session || !txn) return;
    setActing(true);
    try {
      await transactionService.transition({
        transactionId: txn.id,
        to: 'REJECTED',
        actorId: session.userId,
        actorName: session.name,
        actorRole: 'supplier',
        note: 'Supplier rejected the transaction request.',
      });
      setTxn({ ...txn, status: 'REJECTED' });
      toast('info', `Transaction request ${txn.id} rejected.`);
      setTimeout(() => {
        navigate('/app/transactions');
      }, 1000);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to reject request.');
    } finally {
      setActing(false);
    }
  };

  const isPending = txn?.status === 'PENDING' || txn?.status === 'PENDING_SUPPLIER_ACCEPTANCE';
  const totalAmount = txn ? txn.totalAmount : 5760000;
  const quantity = txn ? txn.quantity : 12;
  const unit = txn ? txn.unit : 'tonnes';
  const unitPrice = txn ? txn.pricePerUnit : 480000;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/app/transactions"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          ← Back to Orders &amp; Requests
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Transaction request</h1>
          <p className="text-xs text-gray-500 mt-1">
            {txn?.id || 'REQ-2210'} · From {txn?.buyerName || 'Kola Farms Ltd'} · Delivery to {txn?.deliveryLocation || 'Ikeja, Lagos'}
          </p>
        </div>
        <div>
          <span className={`status-pill ${isPending ? 'status-pill-gray' : 'status-pill-green'}`}>
            {txn?.status || 'PENDING_SUPPLIER_ACCEPTANCE'}
          </span>
        </div>
      </div>

      {/* Expiry Banner */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-800 flex items-center gap-2">
          <span>⏰</span>
          <span className="font-medium">Action Required: Review terms and accept to reserve inventory and notify buyer for escrow payment.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Buyer details & Stock Impact */}
        <div className="lg:col-span-2 space-y-4">
          {/* Buyer Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Buyer
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center font-bold text-gray-900">
                {txn?.buyerName?.[0] || 'K'}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{txn?.buyerName || 'Kola Farms Ltd'}</div>
                <div className="text-xs text-gray-500">
                  {txn?.deliveryLocation || 'Ikeja, Lagos'} · Verified buyer account
                </div>
              </div>
            </div>
          </div>

          {/* What is being requested */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              What is being requested
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-gray-500">Commodity</div>
                <div className="font-semibold text-gray-900 mt-0.5">{txn ? formatCommodity(txn.commodity) : 'White Maize'}</div>
              </div>
              <div>
                <div className="text-gray-500">Grade requested</div>
                <div className="font-semibold text-gray-900 mt-0.5">Grade {txn?.qualityGrade || 'A'}</div>
              </div>
              <div>
                <div className="text-gray-500">Quantity</div>
                <div className="font-semibold text-gray-900 mt-0.5">{quantity} {unit}</div>
              </div>
              <div>
                <div className="text-gray-500">Price per unit</div>
                <div className="font-semibold text-gray-900 mt-0.5">{formatCurrency(unitPrice)} / {unit}</div>
              </div>
              <div>
                <div className="text-gray-500">Pickup from</div>
                <div className="font-semibold text-gray-900 mt-0.5">{txn?.pickupLocation || 'Ogbomoso, Oyo State'}</div>
              </div>
              <div>
                <div className="text-gray-500">Needed by</div>
                <div className="font-semibold text-gray-900 mt-0.5">
                  {txn?.expectedDeliveryDate ? new Date(txn.expectedDeliveryDate).toLocaleDateString() : '8 Sep 2026'}
                </div>
              </div>
            </div>
          </div>

          {/* Stock impact */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Stock impact
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Current available supply</span>
                <span className="font-medium text-gray-900">{listing ? `${listing.quantity} ${listing.unit}` : `18 ${unit}`}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 text-amber-700">
                <span>Committed for this order</span>
                <span className="font-medium">{quantity} {unit}</span>
              </div>
              <div className="flex justify-between py-1 text-gray-900 font-semibold">
                <span>Remaining balance</span>
                <span>{listing ? `${Math.max(0, listing.quantity - quantity)} ${listing.unit}` : `6 ${unit}`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payout & Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              You receive
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Goods subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Platform fee</span>
                <span className="font-medium text-gray-900">Paid by buyer</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Net Payout</span>
                <span className="text-gray-900">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={acting}
                  onClick={handleAccept}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {acting ? 'Processing...' : 'Accept transaction request'}
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={handleReject}
                  className="w-full py-2.5 px-4 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            ) : (
              <div className="pt-2 text-center text-xs font-semibold text-gray-900 bg-green-50 p-2.5 rounded-lg border border-green-200">
                Status: {txn?.status?.replace(/_/g, ' ') || 'ACCEPTED'}
              </div>
            )}
          </div>

          {/* If You Accept info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-2">
            <h3 className="text-xs font-semibold text-gray-700">If you accept</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              The buyer is immediately prompted to secure payment in escrow. Once confirmed, a logistics
              carrier is dispatched and you prepare the cargo for collection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
