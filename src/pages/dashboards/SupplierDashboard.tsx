import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Clock, CheckCircle2, ArrowRightLeft, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { transactionService } from '../../services/transactionService';
import { supplyService } from '../../services/supplyService';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatCommodity } from '../../utils/format';
import { EscrowEarningsCard } from '../../components/wallet/EscrowEarningsCard';
import type { Transaction, SupplyListing } from '../../types';

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-xl p-4 border ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{label}</span>
        <div className="opacity-60">{icon}</div>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

export function SupplierDashboard() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [listings, setListings] = useState<SupplyListing[]>([]);
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [_loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [liveListings, liveTxns] = await Promise.all([
        supplyService.fetchMine(),
        transactionService.fetchMine(),
      ]);
      setListings(liveListings);
      setAllTxns(liveTxns);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session) return null;

  const activeListings = listings.filter((l) => l.status === 'active').length;
  const pending = allTxns.filter((t) => t.status === 'PENDING' || t.status === 'PENDING_SUPPLIER_ACCEPTANCE').length;
  const accepted = allTxns.filter((t) => t.status === 'ACCEPTED').length;
  const awaitingPayment = allTxns.filter((t) => ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED'].includes(t.status)).length;
  const inFulfilment = allTxns.filter((t) => ['LOGISTICS_PENDING','LOGISTICS_ASSIGNED','LOGISTICS_ACCEPTED','READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT'].includes(t.status)).length;
  const completed = allTxns.filter((t) => t.status === 'COMPLETED').length;

  const recentTxns = [...allTxns].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{session.name} · Northern operations</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/app/supply/new')}>
          Create Supply Listing
        </Button>
      </div>

      {/* Escrow Earnings & Withdrawal Payouts */}
      <EscrowEarningsCard
        userId={session.userId}
        userName={session.name}
        userRole="supplier"
        onUpdated={load}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Active Listings" value={activeListings} icon={<Package className="w-4 h-4" />} color="bg-agri-50 border-agri-200 text-agri-900" />
        <StatCard label="Pending Requests" value={pending} icon={<Clock className="w-4 h-4" />} color="bg-amber-50 border-amber-200 text-amber-900" />
        <StatCard label="Accepted" value={accepted} icon={<CheckCircle2 className="w-4 h-4" />} color="bg-blue-50 border-blue-200 text-blue-900" />
        <StatCard label="Awaiting Payment" value={awaitingPayment} icon={<ArrowRightLeft className="w-4 h-4" />} color="bg-orange-50 border-orange-200 text-orange-900" />
        <StatCard label="In Fulfilment" value={inFulfilment} icon={<Truck className="w-4 h-4" />} color="bg-violet-50 border-violet-200 text-violet-900" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="w-4 h-4" />} color="bg-emerald-50 border-emerald-200 text-emerald-900" />
      </div>

      {pending > 0 && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              {pending} transaction request{pending > 1 ? 's' : ''} awaiting your review
            </p>
          </div>
          <Button size="sm" variant="warning" onClick={() => navigate('/app/transactions')}>Review Now</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Transaction Requests</h2>
            <button onClick={() => navigate('/app/transactions')} className="text-xs text-agri-600 font-medium hover:text-agri-700">View all</button>
          </div>
          <CardContent className="p-0">
            {recentTxns.length === 0 ? (
              <EmptyState title="No requests yet" description="Publish supply listings to receive transaction requests." />
            ) : (
              <div className="divide-y divide-gray-50">
                {recentTxns.map((t) => (
                  <div key={t.id} onClick={() => navigate(`/app/transactions/${t.id}`)} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
                    <div>
                      <div className="text-xs font-mono text-gray-400 mb-0.5">{t.id}</div>
                      <div className="text-sm font-medium text-gray-800">{formatCommodity(t.commodity)}</div>
                      <div className="text-xs text-gray-500">{t.quantity} {t.unit} · {t.buyerName}</div>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={t.status} size="sm" />
                      <div className="text-xs text-gray-500 mt-1">{formatCurrency(t.totalAmount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">My Supply Listings</h2>
            <button onClick={() => navigate('/app/supply/manage')} className="text-xs text-agri-600 font-medium hover:text-agri-700">Manage</button>
          </div>
          <CardContent className="p-0">
            {listings.length === 0 ? (
              <EmptyState title="No listings yet" description="Create a supply listing to start receiving requests." />
            ) : (
              <div className="divide-y divide-gray-50">
                {listings.slice(0, 5).map((l) => (
                  <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{formatCommodity(l.commodity)}</div>
                      <div className="text-xs text-gray-500">{l.quantity} {l.unit} · Grade {l.qualityGrade} · {l.location}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-700">{formatCurrency(l.pricePerUnit)}/{l.unit}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block font-medium
                        ${l.status === 'active' ? 'bg-agri-100 text-agri-700' : 'bg-gray-100 text-gray-600'}`}>
                        {l.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
