import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, Hand } from 'lucide-react';
import { logisticsService } from '../services/logisticsService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { formatCurrency, formatDate, formatCommodity } from '../utils/format';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  ASSIGNED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  ACCEPTED: 'bg-blue-50 text-blue-800 border-blue-200',
  REJECTED: 'bg-red-50 text-red-800 border-red-200',
  READY_FOR_PICKUP: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  PICKED_UP: 'bg-sky-50 text-sky-800 border-sky-200',
  IN_TRANSIT: 'bg-violet-50 text-violet-800 border-violet-200',
  DELIVERED: 'bg-teal-50 text-teal-800 border-teal-200',
  COMPLETED: 'bg-green-50 text-green-800 border-green-200',
  FAILED: 'bg-red-50 text-red-800 border-red-200',
};

export function LogisticsJobsPage() {
  const { session, refreshNotifications } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'assigned' | 'open'>('assigned');
  const [claiming, setClaiming] = useState<string | null>(null);

  if (!session) return null;

  const myJobs = logisticsService.getForProvider(session.userId);
  const openJobs = logisticsService.getPending();

  const sortedMyJobs = [...myJobs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const priorityOrder = ['ASSIGNED', 'ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'FAILED'];
  const orderedMyJobs = [...sortedMyJobs].sort((a, b) => priorityOrder.indexOf(a.status) - priorityOrder.indexOf(b.status));

  const handleClaim = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClaiming(jobId);
    try {
      await logisticsService.claimJob(jobId, session.userId, session.name);
      toast('success', `Job ${jobId} claimed! You are now the assigned logistics carrier.`);
      refreshNotifications();
      setActiveTab('assigned');
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to claim job.');
    } finally {
      setClaiming(null);
    }
  };

  const currentList = activeTab === 'assigned' ? orderedMyJobs : openJobs;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Job Queue</h1>
        <p className="text-xs text-gray-500 mt-1">Manage assigned consignments and claim open delivery routes.</p>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 -mb-px">
          {([
            { key: 'assigned' as const, label: 'My Assigned Jobs', count: myJobs.length },
            { key: 'open' as const, label: 'Open Jobs', count: openJobs.length },
          ]).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeTab === tab.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {currentList.length === 0 ? (
        <div className="py-16 text-center">
          <Truck size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm font-semibold text-gray-700 mb-1">
            {activeTab === 'assigned' ? 'No jobs assigned yet' : 'No open jobs available'}
          </div>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            {activeTab === 'assigned'
              ? 'Check the "Open Jobs" tab to claim a delivery, or wait for an assignment.'
              : 'All active transactions already have carriers assigned.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((j) => (
            <div
              key={j.id}
              onClick={() => navigate(activeTab === 'assigned' ? `/app/jobs/${j.id}` : `/app/assignments/${j.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gray-300 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[11px] font-mono text-gray-400 mb-0.5">{j.id}</div>
                  <h3 className="text-sm font-bold text-gray-900">{formatCommodity(j.commodity)}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">{j.quantity} {j.unit}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[j.status] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                    {j.status.replace(/_/g, ' ')}
                  </span>
                  {activeTab === 'open' && (
                    <button
                      type="button"
                      disabled={claiming === j.id}
                      onClick={(e) => handleClaim(j.id, e)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                    >
                      <Hand size={12} />
                      {claiming === j.id ? 'Claiming…' : 'Claim Job'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                <MapPin size={12} className="text-gray-400 shrink-0" />
                <span className="font-medium">{j.pickupLocation}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{j.deliveryLocation}</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span>Expected: <span className="font-semibold text-gray-700">{formatDate(j.expectedDeliveryDate)}</span></span>
                <span>Fee: <span className="font-semibold text-gray-700">{formatCurrency(j.logisticsCost, j.currency)}</span></span>
                <span className="font-mono text-gray-400">TXN: {j.transactionId}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
