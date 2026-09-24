import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { disputeService } from '../../services/disputeService';
import { transactionService } from '../../services/transactionService';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea, Select } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDateTime } from '../../utils/format';
import { invokeContract, txIdToScVal, getWalletKey } from '../../lib/stellar';
import { FreighterBanner } from '../../components/ui/FreighterBanner';
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
      // If dispute is upheld (cancelled), refund buyer on-chain
      if (resolution.outcome === 'cancelled') {
        const pubKey = await getWalletKey();
        if (!pubKey) throw new Error('Connect Freighter wallet as admin to authorize refund');
        const txIdVal = await txIdToScVal(resolving.transactionId);
        const hash = await invokeContract('refund', [txIdVal], pubKey);
        toast('info', `On-chain refund submitted: ${hash.slice(0, 10)}...`);
      }

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
    RESOLVED: 'bg-agri-50 border-agri-200 text-agri-700',
    CLOSED: 'bg-gray-50 border-gray-200 text-gray-600',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <FreighterBanner />

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
                    <Button
                      size="sm"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={() => { setResolving(d); setResolution({ decision: '', outcome: 'completed' }); }}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">{d.description}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-gray-500">Raised by: </span><span className="font-medium">{d.raisedByName}</span></div>
                  <div><span className="text-gray-500">Date: </span><span>{formatDateTime(d.createdAt)}</span></div>
                  {txn && <div className="col-span-2"><span className="text-gray-500">Transaction status: </span><StatusBadge status={txn.status} size="sm" /></div>}
                  {d.resolution && (
                    <div className="col-span-2 mt-1 px-3 py-2 bg-agri-50 border border-agri-200 rounded-lg">
                      <div className="text-xs font-medium text-agri-800">Resolution: {d.resolution}</div>
                      <div className="text-xs text-agri-600 mt-0.5">By {d.resolvedByName} · {d.resolvedAt && formatDateTime(d.resolvedAt)}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!resolving} onClose={() => setResolving(null)} title="Resolve Dispute">
        {resolving && (
          <div className="space-y-4">
            <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
              <div className="font-medium">{resolving.reason}</div>
              <div className="text-xs text-gray-500 mt-0.5">Raised by {resolving.raisedByName}</div>
            </div>
            <Textarea
              label="Resolution Decision"
              value={resolution.decision}
              onChange={(e) => setResolution((r) => ({ ...r, decision: e.target.value }))}
              rows={3}
              placeholder="Describe the resolution decision..."
              required
            />
            <Select
              label="Outcome"
              value={resolution.outcome}
              onChange={(e) => setResolution((r) => ({ ...r, outcome: e.target.value as any }))}
            >
              <option value="completed">Complete Transaction (goods accepted)</option>
              <option value="cancelled">Cancel Transaction (dispute upheld — refund buyer on Stellar)</option>
            </Select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setResolving(null)}>Cancel</Button>
              <Button loading={loading} onClick={handleResolve} icon={<CheckCircle2 className="w-4 h-4" />}>
                Confirm Resolution
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
