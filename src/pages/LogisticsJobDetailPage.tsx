import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CheckCircle2, Package, Truck, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { logisticsService } from '../services/logisticsService';
import { transactionService } from '../services/transactionService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { formatCurrency, formatDate, formatDateTime, formatCommodity } from '../utils/format';
import type { LogisticsJob, Transaction } from '../types';

const NEXT_ACTIONS: Record<string, { label: string; icon: React.ReactNode; to: string; danger?: boolean }[]> = {
  ASSIGNED: [
    { label: 'Accept Job', icon: <ThumbsUp className="w-3.5 h-3.5" />, to: 'ACCEPTED' },
    { label: 'Reject Job', icon: <ThumbsDown className="w-3.5 h-3.5" />, to: 'REJECTED', danger: true },
  ],
  ACCEPTED: [
    { label: 'Ready for Pickup', icon: <MapPin className="w-3.5 h-3.5" />, to: 'READY_FOR_PICKUP' },
  ],
  READY_FOR_PICKUP: [
    { label: 'Picked Up', icon: <Package className="w-3.5 h-3.5" />, to: 'PICKED_UP' },
  ],
  PICKED_UP: [
    { label: 'In Transit', icon: <Truck className="w-3.5 h-3.5" />, to: 'IN_TRANSIT' },
  ],
  IN_TRANSIT: [
    { label: 'Mark Delivered', icon: <CheckCircle2 className="w-3.5 h-3.5" />, to: 'DELIVERED' },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  ACCEPTED: 'bg-blue-50 border-blue-200 text-blue-800',
  READY_FOR_PICKUP: 'bg-cyan-50 border-cyan-200 text-cyan-800',
  PICKED_UP: 'bg-sky-50 border-sky-200 text-sky-800',
  IN_TRANSIT: 'bg-violet-50 border-violet-200 text-violet-800',
  DELIVERED: 'bg-teal-50 border-teal-200 text-teal-800',
  COMPLETED: 'bg-green-50 border-green-200 text-green-800',
  REJECTED: 'bg-red-50 border-red-200 text-red-800',
};

export function LogisticsJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, refreshNotifications } = useApp();
  const { toast } = useToast();
  const [job, setJob] = useState<LogisticsJob | null>(null);
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPodModal, setShowPodModal] = useState(false);
  const [pod, setPod] = useState({ recipientName: '', deliveryNote: '' });

  const refresh = async () => {
    if (!id) return;
    const j = logisticsService.getById(id);
    setJob(j);
    if (j) setTxn(await transactionService.getById(j.transactionId));
  };

  useEffect(() => { refresh(); }, [id]);

  if (!job || !session) return <div className="p-6 text-gray-500">Job not found.</div>;

  const nextActions = NEXT_ACTIONS[job.status] ?? [];

  const handleAction = async (to: string) => {
    if (to === 'DELIVERED') { setShowPodModal(true); return; }
    setLoading(true);
    try {
      await logisticsService.updateJobStatus({
        jobId: job.id, status: to as any,
        providerId: session.userId, providerName: session.name,
      });
      toast('success', `Status updated to ${to.replace(/_/g, ' ')}.`);
      refreshNotifications();
      await refresh();
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  const handleDeliver = async () => {
    if (!pod.recipientName || !pod.deliveryNote) {
      toast('error', 'Please fill in recipient name and delivery note.');
      return;
    }
    setLoading(true);
    try {
      await logisticsService.updateJobStatus({
        jobId: job.id, status: 'DELIVERED',
        providerId: session.userId, providerName: session.name,
        proofOfDelivery: {
          recipientName: pod.recipientName,
          deliveryNote: pod.deliveryNote,
          timestamp: new Date().toISOString(),
          recordedBy: session.name,
        },
      });
      toast('success', 'Shipment marked as delivered. Proof of delivery recorded.');
      setShowPodModal(false);
      refreshNotifications();
      await refresh();
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{job.id}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[job.status] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              {job.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500">{formatCommodity(job.commodity)} · {job.quantity} {job.unit}</p>
        </div>
      </div>

      {/* Action area */}
      {nextActions.length > 0 && (
        <div className="px-4 py-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <p className="text-sm font-semibold text-indigo-800 mb-3">Action Required</p>
          <div className="flex flex-wrap gap-2">
            {nextActions.map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={loading}
                onClick={() => handleAction(a.to)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50 ${
                  a.danger
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Shipment Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Shipment Details</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Pickup</div>
                <div className="text-sm font-semibold text-gray-800">{job.pickupLocation}</div>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="h-8 w-px bg-gray-200 relative">
                <Truck className="w-4 h-4 text-gray-400 absolute -left-2 top-2" />
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Delivery</div>
                <div className="text-sm font-semibold text-gray-900">{job.deliveryLocation}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 text-xs">
              <div><div className="text-gray-500 mb-0.5">Commodity</div><div className="font-medium text-gray-800">{formatCommodity(job.commodity)}</div></div>
              <div><div className="text-gray-500 mb-0.5">Quantity</div><div className="font-medium text-gray-800">{job.quantity} {job.unit}</div></div>
              <div><div className="text-gray-500 mb-0.5">Expected Delivery</div><div className="font-medium text-gray-800">{formatDate(job.expectedDeliveryDate)}</div></div>
              <div><div className="text-gray-500 mb-0.5">Logistics Fee</div><div className="font-bold text-gray-900">{formatCurrency(job.logisticsCost)}</div></div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Transaction ref */}
          {txn && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Transaction</h2>
              <div className="space-y-2 text-xs">
                <div><div className="text-gray-500 mb-0.5">Transaction ID</div><div className="font-mono text-gray-700">{txn.id}</div></div>
                <div><div className="text-gray-500 mb-0.5">Buyer</div><div className="text-gray-700">{txn.buyerName}</div></div>
                <div><div className="text-gray-500 mb-0.5">Value</div><div className="font-bold text-gray-900 text-sm">{formatCurrency(txn.totalAmount)}</div></div>
                <div>
                  <div className="text-gray-500 mb-0.5">Status</div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 inline-block">
                    {txn.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Proof of delivery */}
          {job.proofOfDelivery && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Proof of Delivery</h2>
              <div className="px-3 py-3 bg-green-50 border border-green-200 rounded-lg space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Delivery Evidence Recorded
                </div>
                <div className="text-xs"><span className="text-gray-500">Received by: </span><span className="font-medium text-gray-800">{job.proofOfDelivery.recipientName}</span></div>
                <div className="text-xs"><span className="text-gray-500">Note: </span><span className="text-gray-700">{job.proofOfDelivery.deliveryNote}</span></div>
                <div className="text-xs text-gray-400">{formatDateTime(job.proofOfDelivery.timestamp)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Proof of delivery modal */}
      {showPodModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPodModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Proof of Delivery</h2>
              <button type="button" onClick={() => setShowPodModal(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-gray-600">Record delivery details before marking the shipment as delivered.</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Recipient Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                value={pod.recipientName}
                onChange={(e) => setPod((p) => ({ ...p, recipientName: e.target.value }))}
                placeholder="Name of person who received the goods"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Note <span className="text-red-500">*</span></label>
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"
                value={pod.deliveryNote}
                onChange={(e) => setPod((p) => ({ ...p, deliveryNote: e.target.value }))}
                rows={3}
                placeholder="Condition of goods, any notes on delivery..."
              />
            </div>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              A delivery timestamp will be automatically recorded.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPodModal(false)}
                className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDeliver}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Mark Delivered
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
