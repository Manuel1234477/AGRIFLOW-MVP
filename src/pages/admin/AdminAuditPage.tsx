import { auditService } from '../../services/auditService';
import { formatDateTime } from '../../utils/format';
import { BookOpen } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  transaction_initiated: 'bg-blue-100 text-blue-700',
  transaction_accepted: 'bg-green-100 text-green-700',
  transaction_rejected: 'bg-red-100 text-red-700',
  payment_initiated: 'bg-orange-100 text-orange-700',
  payment_confirmed: 'bg-emerald-100 text-emerald-700',
  payment_failed: 'bg-red-100 text-red-700',
  logistics_job_created: 'bg-violet-100 text-violet-700',
  logistics_provider_assigned: 'bg-indigo-100 text-indigo-700',
  logistics_job_accepted: 'bg-blue-100 text-blue-700',
  shipment_ready: 'bg-cyan-100 text-cyan-700',
  shipment_picked_up: 'bg-sky-100 text-sky-700',
  shipment_in_transit: 'bg-violet-100 text-violet-700',
  shipment_delivered: 'bg-teal-100 text-teal-700',
  delivery_confirmed: 'bg-green-100 text-green-700',
  transaction_completed: 'bg-green-100 text-green-700',
  dispute_raised: 'bg-red-100 text-red-700',
  dispute_resolved: 'bg-green-100 text-green-700',
  supply_created: 'bg-green-100 text-green-700',
  demand_created: 'bg-blue-100 text-blue-700',
  match_generated: 'bg-purple-100 text-purple-700',
  user_registered: 'bg-gray-100 text-gray-700',
  data_reset: 'bg-amber-100 text-amber-700',
};

export function AdminAuditPage() {
  const events = auditService.getAll();

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-5 h-5 text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail ({events.length} events)</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-50">
          {events.map((ev) => (
            <div key={ev.id} className="px-5 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[ev.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {ev.action.replace(/_/g, ' ')}
                    </span>
                    {ev.transactionId && (
                      <span className="text-[10px] font-mono text-gray-400">{ev.transactionId}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700">{ev.detail ?? ev.action}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    by <span className="font-medium">{ev.actorName}</span>
                    <span className="text-gray-400"> · {ev.actorRole}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 text-right shrink-0">
                  {formatDateTime(ev.createdAt)}
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-400">No audit events recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
