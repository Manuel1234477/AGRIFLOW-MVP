import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { transactionService } from '../../services/transactionService';
import { supplyService } from '../../services/supplyService';
import { EscrowEarningsCard } from '../../components/wallet/EscrowEarningsCard';
import { formatCurrency, formatCommodity } from '../../utils/format';
import type { Transaction, SupplyListing } from '../../types';

function greeting(name: string) {
  const h = new Date().getHours();
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = name.split(' ')[0];
  return `${time}, ${first}.`;
}

export function SupplierDashboard() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [listings, setListings] = useState<SupplyListing[]>([]);
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { load(); }, [load]);

  if (!session) return null;

  const activeListings = listings.filter((l) => l.status === 'active').length;
  const pending = allTxns.filter((t) => t.status === 'PENDING' || t.status === 'PENDING_SUPPLIER_ACCEPTANCE').length;
  const inFulfilment = allTxns.filter((t) =>
    ['LOGISTICS_PENDING','LOGISTICS_ASSIGNED','LOGISTICS_ACCEPTED','READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT'].includes(t.status)
  ).length;
  const completed = allTxns.filter((t) => t.status === 'COMPLETED').length;

  const recentTxns = [...allTxns]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      PAYMENT_PENDING: 'status-pill status-pill-amber',
      PAYMENT_CONFIRMED: 'status-pill status-pill-green',
      IN_TRANSIT: 'status-pill status-pill-blue',
      BUYER_CONFIRMATION_PENDING: 'status-pill status-pill-purple',
      DELIVERED: 'status-pill status-pill-purple',
      COMPLETED: 'status-pill status-pill-green',
      PENDING: 'status-pill status-pill-gray',
      PENDING_SUPPLIER_ACCEPTANCE: 'status-pill status-pill-amber',
    };
    return <span className={map[status] ?? 'status-pill status-pill-gray'}>{status.replace(/_/g, '_')}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {loading ? 'Dashboard' : greeting(session.name)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Loading…' : `${activeListings} active listing${activeListings !== 1 ? 's' : ''} · ${pending} pending request${pending !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/supply/new')}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={15} />
          Create Supply Listing
        </button>
      </div>

      {/* Escrow earnings */}
      <EscrowEarningsCard
        userId={session.userId}
        userName={session.name}
        userRole="supplier"
        onUpdated={load}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active listings', value: activeListings },
          { label: 'Pending requests', value: pending },
          { label: 'In fulfilment', value: inFulfilment },
          { label: 'Completed orders', value: completed },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">{label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {pending > 0 && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800">
            {pending} transaction request{pending > 1 ? 's' : ''} awaiting your review
          </p>
          <Link
            to="/app/transactions"
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline"
          >
            Review now →
          </Link>
        </div>
      )}

      {/* Recent activity table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Recent Activity</h2>
          <Link to="/app/transactions" className="text-xs font-semibold text-gray-600 hover:text-gray-900">
            View all →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-3.5">Transaction</th>
                <th className="px-6 py-3.5">Commodity</th>
                <th className="px-6 py-3.5">Buyer</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {recentTxns.length > 0 ? (
                recentTxns.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => navigate(`/app/transactions/${tx.id}`)}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900 font-mono">{tx.id}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {formatCommodity(tx.commodity)} · {tx.quantity} {tx.unit}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{tx.buyerName}</td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{formatCurrency(tx.totalAmount)}</td>
                    <td className="px-6 py-4">{getStatusBadge(tx.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    {loading
                      ? 'Loading activity…'
                      : 'No transactions yet. Create a supply listing to start receiving requests.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supply listings preview */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">My Supply Listings</h2>
          <Link to="/app/supply/manage" className="text-xs font-semibold text-gray-600 hover:text-gray-900">
            Manage →
          </Link>
        </div>
        {listings.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            No listings yet. Create a supply listing to start receiving requests.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {listings.slice(0, 5).map((l) => (
              <div key={l.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-800">{formatCommodity(l.commodity)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {l.quantity} {l.unit} · Grade {l.qualityGrade} · {l.location}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-gray-700">{formatCurrency(l.pricePerUnit)}/{l.unit}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block font-medium ${
                    l.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
