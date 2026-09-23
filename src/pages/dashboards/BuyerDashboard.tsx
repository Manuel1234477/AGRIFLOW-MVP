import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { transactionService } from '../../services/transactionService';
import { demandService } from '../../services/demandService';
import { formatCommodity } from '../../utils/format';
import type { Transaction, DemandRequest } from '../../types';

export function BuyerDashboard() {
  const { session } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [demands, setDemands] = useState<DemandRequest[]>([]);
  const [loading, setLoading] = useState(true);

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
  const awaitingPaymentCount = transactions.filter((t) => t.status === 'PAYMENT_PENDING' || t.status === 'ACCEPTED').length;
  const inTransitCount = transactions.filter((t) => t.status === 'IN_TRANSIT' || t.status === 'LOGISTICS_ASSIGNED' || t.status === 'PICKED_UP').length;
  const completedCount = transactions.filter((t) => t.status === 'COMPLETED' || t.status === 'DELIVERY_CONFIRMED').length;

  const getAction = (tx: Transaction) => {
    switch (tx.status) {
      case 'PAYMENT_PENDING':
      case 'ACCEPTED':
        return (
          <Link
            to={`/app/transactions/${tx.id}/pay`}
            className="text-xs font-semibold text-agri-700 hover:text-agri-800 underline"
          >
            Pay now
          </Link>
        );
      case 'IN_TRANSIT':
      case 'PICKED_UP':
      case 'LOGISTICS_ASSIGNED':
      case 'LOGISTICS_ACCEPTED':
        return (
          <Link
            to={`/app/transactions/${tx.id}/track`}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline"
          >
            Track shipment
          </Link>
        );
      case 'BUYER_CONFIRMATION_PENDING':
      case 'DELIVERED':
        return (
          <Link
            to={`/app/transactions/${tx.id}/confirm`}
            className="text-xs font-semibold text-purple-700 hover:text-purple-800 underline"
          >
            Confirm receipt
          </Link>
        );
      default:
        return (
          <Link
            to={`/app/transactions/${tx.id}`}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline"
          >
            View details
          </Link>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_PENDING':
        return <span className="status-pill status-pill-amber">PAYMENT_PENDING</span>;
      case 'PAYMENT_CONFIRMED':
        return <span className="status-pill status-pill-green">PAYMENT_CONFIRMED</span>;
      case 'IN_TRANSIT':
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">
            {loading ? 'Loading real-time data from database…' : `${transactions.length} total transactions · ${openDemandsCount} open demands`}
          </p>
        </div>
        <Link
          to="/app/demands/new"
          className="inline-flex items-center justify-center bg-agri-700 hover:bg-agri-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs"
        >
          + Create Demand
        </Link>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Open demands</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{openDemandsCount}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Awaiting payment</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{awaitingPaymentCount}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">In transit</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{inTransitCount}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Completed orders</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{completedCount}</div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Recent Transactions</h2>
          <Link to="/app/transactions" className="text-xs font-semibold text-agri-700 hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-3.5">Transaction ID</th>
                <th className="px-6 py-3.5">Commodity</th>
                <th className="px-6 py-3.5">Supplier</th>
                <th className="px-6 py-3.5">State</th>
                <th className="px-6 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900 font-mono">
                      <Link to={`/app/transactions/${tx.id}`} className="hover:underline text-agri-800">
                        {tx.id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {formatCommodity(tx.commodity)} · {tx.quantity} {tx.unit}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {tx.supplierName}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {getAction(tx)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    {loading ? 'Loading transactions…' : 'No transactions found. Create a demand to get matched with suppliers.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
