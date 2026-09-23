import { useNavigate } from 'react-router-dom';
import { Users, ArrowRightLeft, Truck, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { transactionService } from '../../services/transactionService';
import { logisticsService } from '../../services/logisticsService';
import { disputeService } from '../../services/disputeService';
import { storageService, STORE_KEYS } from '../../services/storageService';
import { resetPlatformData } from '../../services/seedService';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, formatCommodity } from '../../utils/format';
import { useState, useEffect } from 'react';
import type { User, Transaction } from '../../types';

export function AdminDashboard() {
  const { session, refreshNotifications } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const txs = await transactionService.fetchAll();
        if (isMounted) setAllTxns(txs);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  if (!session) return null;

  const allUsers = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
  const allJobs = logisticsService.getAll();
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">AgriFlow · Transaction coordination overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={() => setShowReset(true)}>
            Reset Data
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {pendingLogistics > 0 && (
        <div className="mb-4 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-medium text-violet-800">
              {pendingLogistics} logistics job{pendingLogistics > 1 ? 's' : ''} awaiting provider assignment
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/app/admin/logistics')}>Assign Now</Button>
        </div>
      )}
      {disputes.length > 0 && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-medium text-red-800">
              {disputes.length} open dispute{disputes.length > 1 ? 's' : ''} require attention
            </p>
          </div>
          <Button size="sm" variant="danger" onClick={() => navigate('/app/admin/disputes')}>Review</Button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Users', value: allUsers.length, icon: <Users className="w-4 h-4" />, color: 'bg-gray-50 border-gray-200 text-gray-900', path: '/app/admin/users' },
          { label: 'Active Suppliers', value: suppliers, icon: <Users className="w-4 h-4" />, color: 'bg-agri-50 border-agri-200 text-agri-900', path: '/app/admin/users' },
          { label: 'Active Buyers', value: buyers, icon: <Users className="w-4 h-4" />, color: 'bg-blue-50 border-blue-200 text-blue-900', path: '/app/admin/users' },
          { label: 'Logistics Providers', value: logistics, icon: <Truck className="w-4 h-4" />, color: 'bg-violet-50 border-violet-200 text-violet-900', path: '/app/admin/users' },
          { label: 'Open Transactions', value: allTxns.filter((t) => !['COMPLETED','CANCELLED','REJECTED'].includes(t.status)).length, icon: <ArrowRightLeft className="w-4 h-4" />, color: 'bg-orange-50 border-orange-200 text-orange-900', path: '/app/admin/transactions' },
          { label: 'Pending Logistics', value: pendingLogistics, icon: <Truck className="w-4 h-4" />, color: 'bg-violet-50 border-violet-200 text-violet-900', path: '/app/admin/logistics' },
          { label: 'Active Shipments', value: activeShipments, icon: <Truck className="w-4 h-4" />, color: 'bg-sky-50 border-sky-200 text-sky-900', path: '/app/admin/logistics' },
          { label: 'Completed', value: completed, icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-emerald-50 border-emerald-200 text-emerald-900', path: '/app/admin/transactions' },
        ].map((s) => (
          <div key={s.label} onClick={() => navigate(s.path)} className={`rounded-xl p-4 border cursor-pointer hover:shadow-md transition-shadow ${s.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium opacity-70">{s.label}</span>
              <div className="opacity-50">{s.icon}</div>
            </div>
            <div className="text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Transaction pipeline */}
      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Transaction Pipeline</h2>
        </div>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(pipeline).map(([stage, count]) => (
              <div key={stage} className="flex-1 min-w-[80px] text-center">
                <div className="text-2xl font-bold text-gray-800">{count}</div>
                <div className="text-xs text-gray-500 mt-0.5 font-medium">{stage}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">All Transactions</h2>
          <button onClick={() => navigate('/app/admin/transactions')} className="text-xs text-agri-600 font-medium hover:text-agri-700">View all</button>
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
                <tr key={t.id} onClick={() => navigate(`/app/transactions/${t.id}`)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{formatCommodity(t.commodity)}</td>
                  <td className="px-5 py-3 text-gray-600">{t.buyerName}</td>
                  <td className="px-5 py-3 text-gray-600">{t.supplierName}</td>
                  <td className="px-5 py-3 text-gray-700 font-medium">{formatCurrency(t.totalAmount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reset modal */}
      <Modal open={showReset} onClose={() => setShowReset(false)} title="Reset Platform Data">
        <div className="space-y-4">
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">This will restore the initial platform data state.</p>
            <p className="text-xs text-amber-700 mt-1">All current transactions, payments, and logistics will be reset to default sample records.</p>
          </div>
          <p className="text-sm text-gray-600">Are you sure you want to reset the platform data?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReset(false)}>Cancel</Button>
            <Button variant="danger" loading={resetting} onClick={doReset} icon={<RotateCcw className="w-4 h-4" />}>
              Reset Platform Data
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
