import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { disputeService } from '../../services/disputeService';
import { transactionService } from '../../services/transactionService';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDateTime } from '../../utils/format';
import type { Dispute, Transaction } from '../../types';

export function AdminDisputesPage() {
  const { session, refreshNotifications } = useApp();
  const { toast } = useToast();
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState({ decision: '', outcome: 'completed' as 'completed' | 'cancelled' });
  const [loading, setLoading] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [txnsById, setTxnsById] = useState<Record<string, Transaction>>({});

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const all = disputeService.getAll();
    setDisputes(all);
    Promise.all(all.map(async (d) => [d.transactionId, await transactionService.getById(d.transactionId)] as const))
      .then((entries) => {
        if (cancelled) return;
        const map: Record<string, Transaction> = {};
        for (const [txnId, t] of entries) if (t) map[txnId] = t;
        setTxnsById(map);
      });
    return () => { cancelled = true; };
  }, [session]);

  if (!session) return null;

  const sorted = [...disputes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleResolve = async () => {
    if (!resolving || !resolution.decision) { toast('error', 'Provide a resolution decision.'); return; }
    setLoading(true);
    try {
      // Update dispute record state via dispute service
      await disputeService.resolve({
        disputeId: resolving.id,
        adminId: session.userId,
        adminName: session.name,
        decision: resolution.decision,
        outcome: resolution.outcome,
      });
      toast('success', 'Dispute resolved.');
      refreshNotifications();
      setDisputes(disputeService.getAll());
      setResolving(null);
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  const STATUS_COLORS: Record<string, string> = {
    OPEN: 'bg-red-50 border-red-200 text-red-700',
    UNDER_REVIEW: 'bg-amber-50 border-amber-200 text-amber-700',
    RESOLVED: 'bg-green-50 border-green-200 text-green-700',
    CLOSED: 'bg-gray-50 border-gray-200 text-gray-600',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Disputes ({disputes.length})</h1>


      {sorted.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="w-7 h-7" />} title="No disputes" description="All transactions are proceeding smoothly." />
      ) : (
        <div className="space-y-3">
          {sorted.map((d) => {
            const txn = txnsById[d.transactionId];
            return (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900">{d.reason}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[d.status] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-gray-400">{d.id} · TXN: {d.transactionId}</div>
                  </div>
                  {(d.status === 'OPEN' || d.status === 'UNDER_REVIEW') && (
                    <button
                      type="button"
                      onClick={() => { setResolving(d); setResolution({ decision: '', outcome: 'completed' }); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolve
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">{d.description}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-gray-500">Raised by: </span><span className="font-medium">{d.raisedByName}</span></div>
                  <div><span className="text-gray-500">Date: </span><span>{formatDateTime(d.createdAt)}</span></div>
                  {txn && <div className="col-span-2"><span className="text-gray-500">Transaction status: </span><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700 inline-block">{txn.status.replace(/_/g,' ')}</span></div>}
                  {d.resolution && (
                    <div className="col-span-2 mt-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-xs font-medium text-gray-800">Resolution: {d.resolution}</div>
                      <div className="text-xs text-gray-500 mt-0.5">By {d.resolvedByName} · {d.resolvedAt && formatDateTime(d.resolvedAt)}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResolving(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Resolve Dispute</h2>
              <button type="button" onClick={() => setResolving(null)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 text-lg leading-none">✕</button>
            </div>
            <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
              <div className="font-medium">{resolving.reason}</div>
              <div className="text-xs text-gray-500 mt-0.5">Raised by {resolving.raisedByName}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Resolution Decision <span className="text-red-500">*</span></label>
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"
                value={resolution.decision}
                onChange={(e) => setResolution((r) => ({ ...r, decision: e.target.value }))}
                rows={3}
                placeholder="Describe the resolution decision..."
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Outcome</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                value={resolution.outcome}
                onChange={(e) => setResolution((r) => ({ ...r, outcome: e.target.value as any }))}
              >
                <option value="completed">Complete Transaction (goods accepted)</option>
                <option value="cancelled">Cancel Transaction (dispute upheld — refund buyer)</option>
              </select>

            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResolving(null)} className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">Cancel</button>
              <button
                type="button"
                disabled={loading}
                onClick={handleResolve}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
