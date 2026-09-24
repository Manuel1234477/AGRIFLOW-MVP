import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, Search, Navigation } from 'lucide-react';
import { logisticsService } from '../services/logisticsService';
import { transactionService } from '../services/transactionService';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate, formatCommodity } from '../utils/format';

type DeliverableFilter = 'all' | 'in_transit' | 'delivered' | 'completed' | 'pending';

const TXN_STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-50 border-green-200 text-green-700',
  IN_TRANSIT: 'bg-blue-50 border-blue-200 text-blue-700',
  DELIVERED: 'bg-purple-50 border-purple-200 text-purple-700',
  PAYMENT_PENDING: 'bg-amber-50 border-amber-200 text-amber-700',
  PAYMENT_CONFIRMED: 'bg-green-50 border-green-200 text-green-700',
  ACCEPTED: 'bg-blue-50 border-blue-200 text-blue-700',
  READY_FOR_PICKUP: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  PICKED_UP: 'bg-sky-50 border-sky-200 text-sky-700',
  DELIVERY_CONFIRMED: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  DISPUTED: 'bg-red-50 border-red-200 text-red-700',
  CANCELLED: 'bg-red-50 border-red-200 text-red-700',
  REJECTED: 'bg-red-50 border-red-200 text-red-700',
};

export function ShipmentsPage() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<DeliverableFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!session) return null;

  let deliverables = [];
  if (session.role === 'logistics') {
    deliverables = logisticsService.getForProvider(session.userId);
  } else {
    // Buyer or supplier — get jobs for their transactions or fallback to active transactions
    const txns =
      session.role === 'buyer'
        ? transactionService.getForBuyer(session.userId)
        : transactionService.getForSupplier(session.userId);

    deliverables = txns.map((t) => {
      const job = logisticsService.getForTransaction(t.id);
      if (job) return job;
      return {
        id: t.logisticsJobId || `DEL-${t.id}`,
        transactionId: t.id,
        commodity: t.commodity,
        quantity: t.quantity,
        unit: t.unit,
        pickupLocation: t.pickupLocation,
        deliveryLocation: t.deliveryLocation,
        pickupDate: t.createdAt,
        expectedDeliveryDate: t.expectedDeliveryDate,
        logisticsCost: Math.round(t.totalAmount * 0.035),
        currency: t.currency,
        status: (t.status === 'IN_TRANSIT'
          ? 'IN_TRANSIT'
          : t.status === 'DELIVERED' || t.status === 'BUYER_CONFIRMATION_PENDING'
            ? 'DELIVERED'
            : t.status === 'COMPLETED'
              ? 'COMPLETED'
              : 'PENDING') as import('../types').LogisticsStatus,
        providerName: 'SwiftHaul Logistics',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  }

  // Filter by tab
  const filteredByTab = deliverables.filter((j) => {
    if (filter === 'all') return true;
    if (filter === 'in_transit') return j.status === 'IN_TRANSIT' || j.status === 'PICKED_UP';
    if (filter === 'delivered') return j.status === 'DELIVERED';
    if (filter === 'completed') return j.status === 'COMPLETED';
    if (filter === 'pending') return j.status === 'PENDING' || j.status === 'ASSIGNED' || j.status === 'ACCEPTED' || j.status === 'READY_FOR_PICKUP';
    return true;
  });

  // Filter by search query
  const filtered = filteredByTab.filter((j) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      j.id.toLowerCase().includes(q) ||
      j.transactionId.toLowerCase().includes(q) ||
      j.commodity.toLowerCase().includes(q) ||
      j.pickupLocation.toLowerCase().includes(q) ||
      j.deliveryLocation.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {session.role === 'logistics' ? 'Active Consignments' : 'Deliverables & Tracking'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Select and track all scheduled and active commodity shipments.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {[
            { id: 'all', label: 'All Deliverables' },
            { id: 'in_transit', label: 'In Transit' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'completed', label: 'Completed' },
            { id: 'pending', label: 'Pending Pickup' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as DeliverableFilter)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === tab.id
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search deliverables…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-gray-900 focus:bg-white"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-7 h-7" />}
          title="No deliverables found"
          description="No shipments match the selected deliverable filter."
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((j) => {
            const txn = transactionService.getById(j.transactionId);
            return (
              <div
                key={j.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-gray-300 transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-mono text-gray-400 mb-0.5">
                      {j.id} · TXN: {j.transactionId}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">
                      {formatCommodity(j.commodity)}
                    </h3>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {j.quantity} {j.unit}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {txn && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-block ${TXN_STATUS_STYLES[txn.status] ?? 'bg-gray-50 border-gray-200 text-gray-600'}`}>{txn.status.replace(/_/g,' ')}</span>}
                    <span className="text-[11px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                      {j.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-700">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="font-medium">{j.pickupLocation}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{j.deliveryLocation}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
                  <div className="flex items-center gap-4 text-gray-500">
                    <span>Expected: <b className="text-gray-800">{formatDate(j.expectedDeliveryDate)}</b></span>
                    {j.providerName && (
                      <span>Carrier: <b className="text-gray-800">{j.providerName}</b></span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/transactions/${j.transactionId}/track`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      Live GPS Map
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        session.role === 'logistics'
                          ? navigate(`/app/jobs/${j.id}`)
                          : navigate(`/app/transactions/${j.transactionId}`)
                      }
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
