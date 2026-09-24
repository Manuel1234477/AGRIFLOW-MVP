import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import { transactionService } from '../services/transactionService';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDateTime, formatCommodity } from '../utils/format';
import type { Transaction } from '../types';

const STATUS_PILL_CLASSES: Record<string, string> = {
  COMPLETED: 'status-pill-green',
  IN_TRANSIT: 'status-pill-blue',
  DELIVERED: 'status-pill-purple',
  PAYMENT_PENDING: 'status-pill-amber',
  REJECTED: 'status-pill-red',
  CANCELLED: 'status-pill-red',
  DISPUTED: 'status-pill-red',
  ACCEPTED: 'status-pill-blue',
  PENDING: 'status-pill-gray',
  PENDING_SUPPLIER_ACCEPTANCE: 'status-pill-gray',
  PAYMENT_CONFIRMED: 'status-pill-green',
  READY_FOR_PICKUP: 'status-pill-blue',
  PICKED_UP: 'status-pill-blue',
  DELIVERY_CONFIRMED: 'status-pill-green',
  LOGISTICS_ASSIGNED: 'status-pill-blue',
  LOGISTICS_ACCEPTED: 'status-pill-blue',
  LOGISTICS_PENDING: 'status-pill-amber',
  LOGISTICS_REJECTED: 'status-pill-red',
  PAYMENT_FAILED: 'status-pill-red',
  PAYMENT_CANCELLED: 'status-pill-red',
  DELIVERY_FAILED: 'status-pill-red',
};

export function TransactionsPage() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const live = await transactionService.fetchMine();
        if (isMounted) setTxns(live);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [session]);

  if (!session) return null;

  const sorted = [...txns].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {session.role === 'buyer' ? 'My Transactions' : session.role === 'supplier' ? 'Transaction Requests' : 'All Transactions'}
      </h1>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<ArrowRightLeft className="w-7 h-7" />}
          title="No transactions yet"
          description={
            loading
              ? 'Loading transactions from database…'
              : session.role === 'buyer'
              ? 'Browse available supply to initiate your first transaction.'
              : 'Transaction requests will appear here.'
          }
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">ID</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Commodity</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">{session.role === 'buyer' ? 'Supplier' : 'Buyer'}</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Value</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/app/transactions/${t.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-gray-900">{t.id}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{formatCommodity(t.commodity)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{session.role === 'buyer' ? t.supplierName : t.buyerName}</td>
                    <td className="px-5 py-3.5 text-gray-600">{t.quantity} {t.unit}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{formatCurrency(t.totalAmount, t.currency)}</td>
                    <td className="px-5 py-3.5"><span className={`status-pill ${STATUS_PILL_CLASSES[t.status] ?? 'status-pill-gray'}`}>{t.status.replace(/_/g,' ')}</span></td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">{formatDateTime(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
