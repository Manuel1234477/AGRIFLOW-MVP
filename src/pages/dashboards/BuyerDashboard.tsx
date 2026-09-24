import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { transactionService } from '../../services/transactionService';
import { demandService } from '../../services/demandService';
import { formatCommodity, formatCurrency } from '../../utils/format';
import type { Transaction, DemandRequest } from '../../types';

type TxFilter = 'all' | 'needs_action' | 'in_transit';

function greeting(name: string) {
  const h = new Date().getHours();
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${time}, ${name}.`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

function activityMessage(tx: Transaction): string {
  switch (tx.status) {
    case 'PAYMENT_PENDING':
    case 'ACCEPTED': return `${tx.supplierName} accepted your request`;
    case 'PAYMENT_CONFIRMED': return `Payment confirmed — ${tx.supplierName}`;
    case 'LOGISTICS_ASSIGNED':
    case 'LOGISTICS_ACCEPTED':
    case 'READY_FOR_PICKUP': return `Logistics assigned for your ${formatCommodity(tx.commodity)}`;
    case 'PICKED_UP':
    case 'IN_TRANSIT': return `Your ${formatCommodity(tx.commodity)} is in transit`;
    case 'BUYER_CONFIRMATION_PENDING':
    case 'DELIVERED': return `${formatCommodity(tx.commodity)} delivered — confirm receipt`;
    case 'COMPLETED': return `Payment released to ${tx.supplierName}`;
    default: return `Transaction ${tx.id} updated`;
  }
}

export function BuyerDashboard() {
  const { session } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [demands, setDemands] = useState<DemandRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [txs, dms] = await Promise.all([
          transactionService.fetchMine(),
          demandService.fetchMine(),
        ]);
        if (isMounted) {
          setTransactions(txs);
          setDemands(dms);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [session]);

  const openDemandsCount = demands.filter((d) => d.status === 'open' || d.status === 'matched').length;
  const awaitingMatchesCount = demands.filter((d) => d.status === 'open').length;

  const awaitingPaymentTxns = transactions.filter((t) => t.status === 'PAYMENT_PENDING' || t.status === 'ACCEPTED');
  const awaitingPaymentCount = awaitingPaymentTxns.length;
  const awaitingPaymentAmount = awaitingPaymentTxns.reduce((s, t) => s + (t.totalAmount || 0), 0);

  const inTransitTxns = transactions.filter((t) =>
    ['IN_TRANSIT', 'LOGISTICS_ASSIGNED', 'LOGISTICS_ACCEPTED', 'PICKED_UP', 'READY_FOR_PICKUP'].includes(t.status)
  );
  const inTransitCount = inTransitTxns.length;
  const nextDelivery = [...inTransitTxns]
    .filter(t => t.expectedDeliveryDate)
    .sort((a, b) => new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime())[0];

  const completedTxns = transactions.filter((t) => t.status === 'COMPLETED' || t.status === 'DELIVERY_CONFIRMED');
  const completedCount = completedTxns.length;
  const completedAmount = completedTxns.reduce((s, t) => s + (t.totalAmount || 0), 0);

  const needsActionCount = transactions.filter(t =>
    ['PAYMENT_PENDING', 'ACCEPTED', 'BUYER_CONFIRMATION_PENDING', 'DELIVERED'].includes(t.status)
  ).length;

  const activeCount = transactions.filter(t =>
    !['COMPLETED', 'DELIVERY_CONFIRMED', 'CANCELLED'].includes(t.status)
  ).length;

  const filteredTxns = transactions.filter(tx => {
    if (txFilter === 'needs_action') return ['PAYMENT_PENDING', 'ACCEPTED', 'BUYER_CONFIRMATION_PENDING', 'DELIVERED'].includes(tx.status);
    if (txFilter === 'in_transit') return ['IN_TRANSIT', 'LOGISTICS_ASSIGNED', 'LOGISTICS_ACCEPTED', 'PICKED_UP', 'READY_FOR_PICKUP'].includes(tx.status);
    return true;
  });

  const urgentTx = transactions.find(t => t.status === 'PAYMENT_PENDING' || t.status === 'ACCEPTED');

  const recentActivity = [...transactions]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const openDemands = demands.filter(d => d.status === 'open' || d.status === 'matched').slice(0, 3);

  const getNextStep = (tx: Transaction) => {
    switch (tx.status) {
      case 'PAYMENT_PENDING':
      case 'ACCEPTED':
        return (
          <Link
            to={`/app/transactions/${tx.id}/pay`}
            className="inline-flex items-center bg-gray-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Pay {tx.totalAmount ? formatCurrency(tx.totalAmount) : ''}
          </Link>
        );
      case 'IN_TRANSIT':
      case 'PICKED_UP':
      case 'LOGISTICS_ASSIGNED':
      case 'LOGISTICS_ACCEPTED':
      case 'READY_FOR_PICKUP':
        return (
          <Link
            to={`/app/transactions/${tx.id}/track`}
            className="inline-flex items-center border border-gray-200 text-gray-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Track delivery
          </Link>
        );
      case 'BUYER_CONFIRMATION_PENDING':
      case 'DELIVERED':
        return (
          <Link
            to={`/app/transactions/${tx.id}/confirm`}
            className="inline-flex items-center border border-purple-200 text-purple-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-purple-50 transition-colors whitespace-nowrap"
          >
            Confirm receipt
          </Link>
        );
      default:
        return (
          <Link
            to={`/app/transactions/${tx.id}`}
            className="text-[11px] text-gray-400 hover:text-gray-700 underline whitespace-nowrap"
          >
            View details
          </Link>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_PENDING':
      case 'ACCEPTED':
        return <span className="status-pill status-pill-amber">PAYMENT_PENDING</span>;
      case 'PAYMENT_CONFIRMED':
        return <span className="status-pill status-pill-green">PAYMENT_CONFIRMED</span>;
      case 'IN_TRANSIT':
      case 'PICKED_UP':
      case 'LOGISTICS_ASSIGNED':
      case 'READY_FOR_PICKUP':
        return <span className="status-pill status-pill-blue">IN_TRANSIT</span>;
      case 'BUYER_CONFIRMATION_PENDING':
      case 'DELIVERED':
        return <span className="status-pill status-pill-purple">DELIVERED</span>;
      case 'COMPLETED':
        return <span className="status-pill status-pill-green">COMPLETED</span>;
      default:
        return <span className="status-pill status-pill-gray">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {loading ? 'Dashboard' : greeting(session?.name ?? 'there')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? 'Loading…'
              : needsActionCount > 0
                ? `You have ${needsActionCount} transaction${needsActionCount !== 1 ? 's' : ''} that need your attention today.`
                : `${activeCount} active transaction${activeCount !== 1 ? 's' : ''} · ${openDemandsCount} open demand${openDemandsCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/app/demands"
            className="inline-flex items-center justify-center border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View all demands
          </Link>
          <Link
            to="/app/demands/new"
            className="inline-flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            + Create Demand
          </Link>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="xl:grid xl:grid-cols-[1fr_296px] gap-6 space-y-6 xl:space-y-0">

        {/* LEFT: main content */}
        <div className="space-y-5 min-w-0">

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Open demands</span>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{openDemandsCount}</div>
              <div className="text-xs text-gray-400 mt-1">{awaitingMatchesCount} awaiting matches</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Awaiting payment</span>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{awaitingPaymentCount}</div>
              <div className="text-xs text-gray-400 mt-1">
                {awaitingPaymentAmount > 0 ? `${formatCurrency(awaitingPaymentAmount)} due` : 'None due'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">In transit</span>
                <span className="w-2 h-2 rounded-full bg-blue-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{inTransitCount}</div>
              <div className="text-xs text-gray-400 mt-1">
                {nextDelivery?.expectedDeliveryDate
                  ? `Next delivery ${new Date(nextDelivery.expectedDeliveryDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`
                  : 'No pending deliveries'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Completed this month</span>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{completedCount}</div>
              <div className="text-xs text-gray-400 mt-1">
                {completedAmount > 0 ? `${formatCurrency(completedAmount)} transacted` : 'None yet'}
              </div>
            </div>
          </div>

          {/* Active Transactions */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="px-5 pt-4 pb-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">Active transactions</span>
                  {activeCount > 0 && (
                    <span className="text-xs text-gray-400">{activeCount} in progress</span>
                  )}
                </div>
                <Link to="/app/transactions" className="text-xs font-semibold text-gray-400 hover:text-gray-700">
                  View all →
                </Link>
              </div>
              <div className="flex gap-0 border-b border-gray-100 -mx-5 px-5">
                {([
                  ['all', 'All', null],
                  ['needs_action', 'Needs action', needsActionCount],
                  ['in_transit', 'In transit', inTransitCount],
                ] as [TxFilter, string, number | null][]).map(([val, label, count]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTxFilter(val)}
                    className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                      txFilter === val
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {label}
                    {count !== null && count > 0 && (
                      <span className="ml-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-400 font-medium">
                  <tr>
                    <th className="px-5 py-3">Transaction</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">State</th>
                    <th className="px-5 py-3">Next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-800">
                  {filteredTxns.length > 0 ? (
                    filteredTxns.slice(0, 8).map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold font-mono text-gray-900">{tx.id}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {formatCommodity(tx.commodity)} · {tx.quantity} {tx.unit}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 font-medium">{tx.supplierName}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(tx.status)}</td>
                        <td className="px-5 py-3.5">{getNextStep(tx)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-gray-400">
                        {loading
                          ? 'Loading transactions…'
                          : 'No transactions found. Create a demand to get matched with suppliers.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Open Demands */}
          {openDemands.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Open demands</span>
                <Link to="/app/demands" className="text-xs font-semibold text-gray-400 hover:text-gray-700">
                  Manage
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {openDemands.map(d => (
                  <div key={d.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold text-gray-700">{d.id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          d.status === 'matched'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {d.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCommodity(d.commodity)} · {d.quantity} {d.unit}
                        {d.destinationLocation && ` · ${d.destinationLocation}`}
                      </div>
                    </div>
                    <div className="shrink-0 ml-4">
                      {d.status === 'matched' ? (
                        <Link
                          to={`/app/matches?demand=${d.id}`}
                          className="text-xs font-semibold text-gray-700 hover:text-gray-900 underline whitespace-nowrap"
                        >
                          View matches →
                        </Link>
                      ) : (
                        <Link
                          to={`/app/demands/${d.id}`}
                          className="text-xs text-gray-400 hover:text-gray-700 underline whitespace-nowrap"
                        >
                          View
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: sidebar */}
        <div className="space-y-4 shrink-0">

          {/* Needs your attention */}
          {urgentTx ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Needs your attention</span>
              </div>
              <span className="inline-block text-[11px] font-mono font-bold bg-amber-900/10 text-amber-900 px-2 py-0.5 rounded mb-2">
                {urgentTx.id}
              </span>
              <p className="text-xs text-amber-800 leading-relaxed mb-3">
                Payment for {urgentTx.id} is due. {urgentTx.supplierName} has accepted and is holding {urgentTx.quantity} {urgentTx.unit} of {formatCommodity(urgentTx.commodity)} for you.
              </p>
              <Link
                to={`/app/transactions/${urgentTx.id}/pay`}
                className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
              >
                Pay {urgentTx.totalAmount ? formatCurrency(urgentTx.totalAmount) : 'now'}
              </Link>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[11px] font-bold text-green-800 uppercase tracking-wide">All clear</span>
              </div>
              <p className="text-xs text-green-700 leading-relaxed">
                No immediate actions required. You're all caught up.
              </p>
            </div>
          )}

          {/* Recent activity */}
          {recentActivity.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Recent activity</span>
              </div>
              <div className="divide-y divide-gray-50">
                {recentActivity.map(tx => (
                  <div key={tx.id} className="px-4 py-3">
                    <p className="text-xs text-gray-700 leading-snug">{activityMessage(tx)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-mono text-gray-400">{tx.id}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(tx.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your money is protected */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-800 mb-1">Your money is protected</p>
            <p className="text-xs text-green-700 leading-relaxed">
              AgriFlow holds every payment until you confirm the goods arrived as agreed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
