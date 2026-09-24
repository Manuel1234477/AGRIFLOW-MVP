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

export function DeliveryTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [job, setJob] = useState<LogisticsJob | null>(null);
  const [allDeliverables, setAllDeliverables] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;

    async function loadData() {
      let txns: Transaction[] = [];
      if (session?.role === 'buyer') {
        txns = transactionService.getForBuyer(session.userId);
      } else if (session?.role === 'supplier') {
        txns = transactionService.getForSupplier(session.userId);
      } else if (session?.role === 'logistics') {
        const myJobs = logisticsService.getForProvider(session.userId);
        const jobTxnIds = myJobs.map((j) => j.transactionId);
        txns = transactionService.getAll().filter((t) => jobTxnIds.includes(t.id));
        if (txns.length === 0) {
          txns = transactionService.getAll();
        }
      } else {
        txns = transactionService.getAll();
      }

      if (isMounted) {
        setAllDeliverables(txns);
      }

      const targetId = id || txns[0]?.id;
      if (targetId) {
        const t = await transactionService.fetchById(targetId);
        if (isMounted && t) {
          setTx(t);
          const j =
            logisticsService.getForTransaction(t.id) ||
            (t.logisticsJobId ? logisticsService.getById(t.logisticsJobId) : null);
          setJob(j);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id, session]);

  const progress = tx ? STATUS_PROGRESS[tx.status] ?? 50 : 50;
  const isCompleted = tx?.status === 'COMPLETED';
  const isDelivered = tx?.status === 'DELIVERED' || tx?.status === 'BUYER_CONFIRMATION_PENDING';
  const carrierName =
    job?.providerName ||
    tx?.history?.find((h) => h.actorRole === 'logistics')?.actor ||
    'SwiftHaul Logistics';

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
                  {isCompleted ? 'Escrow Released' : 'Secured in Soroban'}
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
