import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { formatRelativeTime } from '../utils/format';

const TYPE_COLORS: Record<string, string> = {
  transaction_request: 'bg-blue-500',
  transaction_accepted: 'bg-green-500',
  transaction_rejected: 'bg-red-500',
  payment_confirmed: 'bg-emerald-500',
  payment_failed: 'bg-red-500',
  logistics_assigned: 'bg-violet-500',
  logistics_accepted: 'bg-blue-500',
  shipment_update: 'bg-sky-500',
  delivery_received: 'bg-teal-500',
  delivery_confirmed: 'bg-green-500',
  transaction_completed: 'bg-green-600',
  dispute_raised: 'bg-red-500',
  dispute_resolved: 'bg-green-500',
  general: 'bg-gray-400',
};

export function NotificationsPage() {
  const { session, notifications, refreshNotifications } = useApp();
  const navigate = useNavigate();

  if (!session) return null;

  const markAll = () => {
    notificationService.markAllRead(session.userId);
    refreshNotifications();
  };

  const markOne = (id: string) => {
    notificationService.markRead(id);
    refreshNotifications();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={markAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="w-7 h-7" />} title="No notifications" description="You're all caught up." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                markOne(n.id);
                if (n.transactionId) navigate(`/app/transactions/${n.transactionId}`);
              }}
              className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-colors cursor-pointer
                ${n.read ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-blue-50 border-blue-200 hover:bg-blue-100'}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-gray-300' : TYPE_COLORS[n.type] ?? 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{n.title}</div>
                <div className="text-xs text-gray-600 mt-0.5">{n.message}</div>
                <div className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
