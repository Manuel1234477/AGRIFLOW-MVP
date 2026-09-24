import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, User } from 'lucide-react';
import { logisticsService } from '../../services/logisticsService';
import { transactionService } from '../../services/transactionService';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loader2 } from 'lucide-react';
import { formatDate, formatCommodity } from '../../utils/format';
import type { LogisticsJob, Transaction } from '../../types';

export function AdminLogisticsPage() {
  const { session, refreshNotifications } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assigningJob, setAssigningJob] = useState<LogisticsJob | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [txnsById, setTxnsById] = useState<Record<string, Transaction>>({});

  const allJobs = logisticsService.getAll();
  const providers = logisticsService.getProviders();

  const loadTxns = (jobs: LogisticsJob[]) => {
    Promise.all(jobs.map(async (j) => [j.transactionId, await transactionService.getById(j.transactionId)] as const))
      .then((entries) => {
        const map: Record<string, Transaction> = {};
        for (const [txnId, t] of entries) if (t) map[txnId] = t;
        setTxnsById(map);
      });
  };

  useEffect(() => {
    if (!session) return;
    loadTxns(allJobs);
    // Fetch once on mount; handleAssign re-fetches explicitly after a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) return null;

  const sorted = [...allJobs].sort((a, b) => {
    const priority = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
    return priority.indexOf(a.status) - priority.indexOf(b.status);
  });

  const handleAssign = async () => {
    if (!assigningJob || !selectedProvider) { toast('error', 'Select a provider.'); return; }
    const provider = providers.find((p) => p.id === selectedProvider);
    if (!provider) return;
    setLoading(true);
    try {
      await logisticsService.assignProvider(
        assigningJob.id, provider.id, provider.organizationName ?? provider.name,
        session.userId, session.name
      );
      toast('success', `${provider.organizationName ?? provider.name} assigned to job ${assigningJob.id}.`);
      refreshNotifications();
      loadTxns(logisticsService.getAll());
      setAssigningJob(null);
      setSelectedProvider('');
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Logistics Jobs</h1>

      {sorted.length === 0 ? (
        <EmptyState icon={<Truck className="w-7 h-7" />} title="No logistics jobs" description="Jobs are created automatically when payment is confirmed." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Job ID</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Commodity</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Route</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Provider</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">TXN Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Job Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((j) => {
                  const txn = txnsById[j.transactionId];
                  return (
                    <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{j.id}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-800">{formatCommodity(j.commodity)}</div>
                        <div className="text-xs text-gray-500">{j.quantity} {j.unit}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">
                        <div>{j.pickupLocation}</div>
                        <div className="text-gray-400">→ {j.deliveryLocation}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">
                        {j.providerName ? (
                          <span className="font-medium">{j.providerName}</span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {txn && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700 inline-block">{txn.status.replace(/_/g,' ')}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {j.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {j.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => { setAssigningJob(j); setSelectedProvider(''); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
                          >
                            <User className="w-3.5 h-3.5" />
                            Assign Provider
                          </button>
                        )}
                        {j.status !== 'PENDING' && txn && (
                          <button onClick={() => navigate(`/app/transactions/${j.transactionId}`)} className="text-xs text-gray-500 hover:text-gray-800 font-medium">
                            View TXN
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {assigningJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAssigningJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Assign Logistics Provider</h2>
              <button type="button" onClick={() => setAssigningJob(null)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 text-lg leading-none">✕</button>
            </div>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <div className="font-medium">{formatCommodity(assigningJob.commodity)} · {assigningJob.quantity} {assigningJob.unit}</div>
              <div className="text-xs text-gray-500 mt-0.5">{assigningJob.pickupLocation} → {assigningJob.deliveryLocation}</div>
              <div className="text-xs text-gray-500">Expected: {formatDate(assigningJob.expectedDeliveryDate)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Logistics Provider <span className="text-red-500">*</span></label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                required
              >
                <option value="">Select a provider...</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.organizationName ?? p.name} {p.verified ? '✓ Verified' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAssigningJob(null)} className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">Cancel</button>
              <button
                type="button"
                disabled={loading}
                onClick={handleAssign}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                Assign Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
