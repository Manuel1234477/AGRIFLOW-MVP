import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { useApp } from '../context/AppContext';
import { transactionService } from '../services/transactionService';
import { logisticsService } from '../services/logisticsService';
import { LiveDeliveryMap } from '../components/map/LiveDeliveryMap';
import { formatCommodity, formatDateTime } from '../utils/format';
import type { Transaction, LogisticsJob, TransactionStatus } from '../types';

const STATUS_PROGRESS: Partial<Record<TransactionStatus, number>> = {
  PENDING: 5,
  PENDING_SUPPLIER_ACCEPTANCE: 5,
  ACCEPTED: 10,
  REJECTED: 0,
  PAYMENT_PENDING: 15,
  PAYMENT_CONFIRMED: 25,
  LOGISTICS_PENDING: 30,
  LOGISTICS_ASSIGNED: 40,
  LOGISTICS_ACCEPTED: 50,
  LOGISTICS_REJECTED: 30,
  READY_FOR_PICKUP: 60,
  PICKED_UP: 70,
  IN_TRANSIT: 80,
  DELIVERED: 90,
  DELIVERY_CONFIRMED: 95,
  BUYER_CONFIRMATION_PENDING: 95,
  COMPLETED: 100,
  DISPUTED: 50,
  CANCELLED: 0,
  PAYMENT_FAILED: 0,
  PAYMENT_CANCELLED: 0,
  DELIVERY_FAILED: 50,
};

const DELIVERY_ACTIVE_STATUSES: TransactionStatus[] = [
  'PAYMENT_CONFIRMED',
  'LOGISTICS_PENDING',
  'LOGISTICS_ASSIGNED',
  'LOGISTICS_ACCEPTED',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'DELIVERY_CONFIRMED',
  'BUYER_CONFIRMATION_PENDING',
  'COMPLETED',
];

export function DeliveryTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [job, setJob] = useState<LogisticsJob | null>(null);
  const [allDeliverables, setAllDeliverables] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [liveTxns, liveJobs] = await Promise.all([
          transactionService.fetchMine(),
          logisticsService.fetchAll(),
        ]);

        let userTxns = liveTxns;
        if (session?.role === 'logistics') {
          const myJobTxnIds = liveJobs
            .filter((j) => j.providerId === session.userId)
            .map((j) => j.transactionId);
          const filtered = liveTxns.filter((t) => myJobTxnIds.includes(t.id));
          if (filtered.length > 0) {
            userTxns = filtered;
          }
        }

        const validDeliverables = userTxns.filter((t) => DELIVERY_ACTIVE_STATUSES.includes(t.status));
        const activeList = validDeliverables.length > 0 ? validDeliverables : userTxns;

        if (isMounted) {
          setAllDeliverables(activeList);
        }

        let targetTxn: Transaction | null = null;
        if (id) {
          targetTxn = await transactionService.fetchById(id);
          if (!targetTxn) {
            const matchedJob = liveJobs.find((j) => j.id === id);
            if (matchedJob) {
              targetTxn = await transactionService.fetchById(matchedJob.transactionId);
            }
          }
        }

        if (!targetTxn) {
          targetTxn = activeList[0] || null;
        }

        if (isMounted && targetTxn) {
          setTx(targetTxn);
          const j =
            liveJobs.find(
              (job) => job.transactionId === targetTxn!.id || (targetTxn!.logisticsJobId && job.id === targetTxn!.logisticsJobId)
            ) ||
            logisticsService.getForTransaction(targetTxn.id) ||
            (targetTxn.logisticsJobId ? logisticsService.getById(targetTxn.logisticsJobId) : null);
          setJob(j);
        } else if (isMounted) {
          setTx(null);
          setJob(null);
        }
      } catch (err) {
        console.error('Failed to load tracking data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id, session]);

  const hasDelivery = tx !== null;
  const progress = tx ? STATUS_PROGRESS[tx.status] ?? 50 : 50;
  const isCompleted = tx?.status === 'COMPLETED';
  const isDelivered = tx?.status === 'DELIVERED' || tx?.status === 'BUYER_CONFIRMATION_PENDING';
  const carrierName =
    job?.providerName ||
    tx?.history?.find((h) => h.actorRole === 'logistics')?.actor ||
    (['PAYMENT_CONFIRMED', 'LOGISTICS_PENDING'].includes(tx?.status || '')
      ? 'Awaiting Logistics Assignment'
      : 'AgriFlow Logistics Partner');

  if (!loading && (!hasDelivery || allDeliverables.length === 0 || !tx)) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/app/dashboard"
            className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Truck className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">No Active Deliveries at the Moment</h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-6 leading-relaxed">
            There are currently no consignments in transit or scheduled for delivery. The live tracking map will appear here once an accepted trade order is dispatched by the logistics carrier.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/app/transactions"
              className="px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
            >
              View Active Orders
            </Link>
            <Link
              to="/app/dashboard"
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Bar with Back Link & Deliverables Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/app/dashboard"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          ← Back to Dashboard
        </Link>

        {allDeliverables.length > 1 && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-xs">
            <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <label htmlFor="deliverable-select" className="text-xs font-semibold text-gray-700 whitespace-nowrap">
              Switch Deliverable:
            </label>
            <select
              id="deliverable-select"
              value={tx?.id || ''}
              onChange={(e) => navigate(`/app/transactions/${e.target.value}/track`)}
              className="text-xs font-medium text-gray-900 bg-transparent border-0 outline-none cursor-pointer pr-2"
            >
              {allDeliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} · {formatCommodity(d.commodity)} ({d.quantity} {d.unit}) · {d.status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Delivery tracking</h1>
          <p className="text-xs text-gray-500 mt-1">
            {tx ? `${tx.id} · ${formatCommodity(tx.commodity)} · ${tx.quantity} ${tx.unit}` : (id || 'TXN-AGF')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-pill status-pill-blue">{tx?.status || 'IN_TRANSIT'}</span>
          {(isDelivered || tx?.status === 'DELIVERED') && session?.role === 'buyer' && (
            <button
              type="button"
              onClick={() => navigate(`/app/transactions/${tx?.id}/confirm`)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-xs cursor-pointer"
            >
              Confirm Receipt & Release Escrow
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Live Map & Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <LiveDeliveryMap
            originName={tx?.pickupLocation || 'Pickup Hub'}
            destinationName={tx?.deliveryLocation || 'Delivery Destination'}
            progressPercent={progress}
            eta={isCompleted ? 'Delivered' : isDelivered ? 'Arrived at Destination' : 'In Transit · Approx 2h 45m'}
          />

          {/* Timeline Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Consignment Timeline
            </h2>

            {tx?.history && tx.history.length > 0 ? (
              <div className="space-y-4 text-xs">
                {tx.history.map((event, idx) => {
                  const isLatest = idx === tx.history.length - 1;
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                          isLatest
                            ? 'bg-gray-900 ring-4 ring-gray-100'
                            : 'bg-gray-800'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900">{event.status.replace(/_/g, ' ')}</span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {formatDateTime(event.timestamp)}
                          </span>
                        </div>
                        <div className="text-gray-600 mt-0.5">
                          {event.note || `Status updated to ${event.status}`}
                        </div>
                        {event.actor && (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            By: {event.actor} ({event.actorRole})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-900 ring-4 ring-gray-100 mt-1 shrink-0" />
                  <div>
                    <div className="font-bold text-gray-900">{tx?.status || 'IN_TRANSIT'}</div>
                    <div className="text-gray-600 mt-0.5">Consignment active on transit route.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Carrier, Shipment, Actions */}
        <div className="space-y-4">
          {/* Carrier Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Assigned Carrier
            </h2>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center font-bold text-gray-900">
                {carrierName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900">{carrierName}</div>
                <div className="text-[11px] text-gray-500">Verified Logistics Partner</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast('info', `Connecting to dispatch for ${carrierName}...`)}
              className="w-full mt-2 py-2 px-3 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors cursor-pointer"
            >
              Contact Carrier
            </button>
          </div>

          {/* Shipment Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Shipment Details
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Origin / Pickup</span>
                <span className="font-medium text-gray-900 text-right">{tx?.pickupLocation || 'Pickup Hub'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Destination</span>
                <span className="font-medium text-gray-900 text-right">{tx?.deliveryLocation || 'Delivery Depot'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Commodity</span>
                <span className="font-medium text-gray-900">
                  {tx ? `${formatCommodity(tx.commodity)} (${tx.quantity} ${tx.unit})` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Payment Escrow</span>
                <span className="font-semibold text-emerald-700">
                  {isCompleted ? 'Escrow Released' : 'Secured in Escrow'}
                </span>

              </div>
            </div>
          </div>

          {/* Problem with delivery */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-900">Problem with this consignment?</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              If goods are delayed or quality issues occur during transit, notify Operations or initiate dispute resolution.
            </p>
            <button
              type="button"
              onClick={() => navigate('/app/admin/disputes')}
              className="w-full py-2 px-3 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors cursor-pointer"
            >
              Report an Issue / Dispute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
