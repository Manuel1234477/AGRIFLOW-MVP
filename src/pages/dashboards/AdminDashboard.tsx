import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRightLeft, Truck, AlertTriangle, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';

import { useApp } from '../../context/AppContext';
import { transactionService } from '../../services/transactionService';
import { logisticsService } from '../../services/logisticsService';
import { disputeService } from '../../services/disputeService';
import { resetPlatformData } from '../../services/seedService';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, formatCommodity } from '../../utils/format';
import { adminService } from '../../services/adminService';
import type { User, Transaction, LogisticsJob } from '../../types';


function statusPill(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'status-pill status-pill-green',
    PENDING: 'status-pill status-pill-gray',
    PENDING_SUPPLIER_ACCEPTANCE: 'status-pill status-pill-gray',
    ACCEPTED: 'status-pill status-pill-blue',
    PAYMENT_PENDING: 'status-pill status-pill-amber',
    PAYMENT_CONFIRMED: 'status-pill status-pill-green',
    PAYMENT_FAILED: 'status-pill status-pill-red',
    LOGISTICS_PENDING: 'status-pill status-pill-blue',
    LOGISTICS_ASSIGNED: 'status-pill status-pill-blue',
    LOGISTICS_ACCEPTED: 'status-pill status-pill-blue',
    IN_TRANSIT: 'status-pill status-pill-blue',
    DELIVERED: 'status-pill status-pill-purple',
    BUYER_CONFIRMATION_PENDING: 'status-pill status-pill-purple',
    DISPUTED: 'status-pill status-pill-red',
    CANCELLED: 'status-pill status-pill-red',
    REJECTED: 'status-pill status-pill-red',
  };
  return map[status] ?? 'status-pill status-pill-gray';
}

export function AdminDashboard() {
  const { session, refreshNotifications } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [allJobs, setAllJobs] = useState<LogisticsJob[]>([]);
  const [allUsers, setAllUsers] = useState<Omit<User, 'passwordHash'>[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [txs, jobs, usersRes] = await Promise.all([
          transactionService.fetchAll(),
          logisticsService.fetchAll(),
          adminService.fetchUsers({ limit: 100 }),
        ]);
        if (isMounted) {
          setAllTxns(txs);
          setAllJobs(jobs);
          setAllUsers(usersRes.users);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  if (!session) return null;

  const disputes = disputeService.getOpen();


  const buyers = allUsers.filter((u) => u.role === 'buyer').length;
  const suppliers = allUsers.filter((u) => u.role === 'supplier').length;
  const logistics = allUsers.filter((u) => u.role === 'logistics').length;
  const pendingLogistics = allJobs.filter((j) => j.status === 'PENDING').length;
  const activeShipments = allJobs.filter((j) => ['ACCEPTED','READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT'].includes(j.status)).length;
  const completed = allTxns.filter((t) => t.status === 'COMPLETED').length;

  const pipeline: Record<string, number> = {
    PENDING: allTxns.filter((t) => t.status === 'PENDING').length,
    ACCEPTED: allTxns.filter((t) => t.status === 'ACCEPTED').length,
    PAYMENT: allTxns.filter((t) => ['PAYMENT_PENDING','PAYMENT_CONFIRMED'].includes(t.status)).length,
    LOGISTICS: allTxns.filter((t) => ['LOGISTICS_PENDING','LOGISTICS_ASSIGNED','LOGISTICS_ACCEPTED'].includes(t.status)).length,
    'IN TRANSIT': allTxns.filter((t) => ['READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT'].includes(t.status)).length,
    DELIVERED: allTxns.filter((t) => t.status === 'DELIVERED').length,
    COMPLETED: allTxns.filter((t) => t.status === 'COMPLETED').length,
  };

  const doReset = async () => {
    setResetting(true);
    await new Promise((r) => setTimeout(r, 600));
    resetPlatformData();
    refreshNotifications();
    setResetting(false);
    setShowReset(false);
    toast('success', 'Platform data reset to default state.');
    navigate('/app/dashboard');
  };

  const recent = [...allTxns].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 6);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">AgriFlow · Transaction coordination overview</p>
        </div>
        <button
          type="button"
          onClick={() => setShowReset(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Data
        </button>
      </div>

      {/* Alerts */}
      {pendingLogistics > 0 && (
        <div className="px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-medium text-violet-800">
              {pendingLogistics} logistics job{pendingLogistics > 1 ? 's' : ''} awaiting provider assignment
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/admin/logistics')}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
          >
            Assign Now
          </button>
        </div>
      )}
      {disputes.length > 0 && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-medium text-red-800">
              {disputes.length} open dispute{disputes.length > 1 ? 's' : ''} require attention
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/admin/disputes')}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs"
          >
            Review
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: allUsers.length, icon: <Users className="w-4 h-4" />, color: 'bg-gray-50 border-gray-200 text-gray-900', path: '/app/admin/users' },
          { label: 'Active Suppliers', value: suppliers, icon: <Users className="w-4 h-4" />, color: 'bg-green-50 border-green-200 text-green-700', path: '/app/admin/users' },
          { label: 'Active Buyers', value: buyers, icon: <Users className="w-4 h-4" />, color: 'bg-blue-50 border-blue-200 text-blue-900', path: '/app/admin/users' },
          { label: 'Logistics Providers', value: logistics, icon: <Truck className="w-4 h-4" />, color: 'bg-violet-50 border-violet-200 text-violet-900', path: '/app/admin/users' },
          { label: 'Open Transactions', value: allTxns.filter((t) => !['COMPLETED','CANCELLED','REJECTED'].includes(t.status)).length, icon: <ArrowRightLeft className="w-4 h-4" />, color: 'bg-orange-50 border-orange-200 text-orange-900', path: '/app/admin/transactions' },
          { label: 'Pending Logistics', value: pendingLogistics, icon: <Truck className="w-4 h-4" />, color: 'bg-violet-50 border-violet-200 text-violet-900', path: '/app/admin/logistics' },
          { label: 'Active Shipments', value: activeShipments, icon: <Truck className="w-4 h-4" />, color: 'bg-sky-50 border-sky-200 text-sky-900', path: '/app/admin/logistics' },
          { label: 'Completed', value: completed, icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-emerald-50 border-emerald-200 text-emerald-900', path: '/app/admin/transactions' },
        ].map((s) => (
          <div
            key={s.label}
            onClick={() => navigate(s.path)}
            className={`rounded-xl p-4 border cursor-pointer hover:shadow-md transition-shadow ${s.color}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium opacity-70">{s.label}</span>
              <div className="opacity-50">{s.icon}</div>
            </div>
            <div className="text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Transaction pipeline */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Pipeline</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-3">
            {Object.entries(pipeline).map(([stage, count]) => (
              <div key={stage} className="flex-1 min-w-[80px] text-center">
                <div className="text-2xl font-bold text-gray-800">{count}</div>
                <div className="text-xs text-gray-500 mt-0.5 font-medium">{stage}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">All Transactions</h2>
          <button
            type="button"
            onClick={() => navigate('/app/admin/transactions')}
            className="text-xs text-gray-500 font-medium hover:text-gray-800"
          >
            View all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-gray-500">ID</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">Commodity</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">Buyer</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">Supplier</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">Value</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/app/transactions/${t.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{formatCommodity(t.commodity)}</td>
                  <td className="px-5 py-3 text-gray-600">{t.buyerName}</td>
                  <td className="px-5 py-3 text-gray-600">{t.supplierName}</td>
                  <td className="px-5 py-3 text-gray-700 font-medium">{formatCurrency(t.totalAmount)}</td>
                  <td className="px-5 py-3"><span className={statusPill(t.status)}>{t.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset modal */}
      {showReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowReset(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Reset Platform Data</h2>
              <button type="button" onClick={() => setShowReset(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 text-lg leading-none">✕</button>
            </div>
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 font-medium">This will restore the initial platform data state.</p>
              <p className="text-xs text-amber-700 mt-1">All current transactions, payments, and logistics will be reset to default sample records.</p>
            </div>
            <p className="text-sm text-gray-600">Are you sure you want to reset the platform data?</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={doReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Reset Platform Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
