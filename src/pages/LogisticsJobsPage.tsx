import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, Hand } from 'lucide-react';
import { logisticsService } from '../services/logisticsService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
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
  COMPLETED: 'bg-agri-50 text-agri-800 border-agri-200',
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Logistics Job Queue</h1>
          <p className="text-xs text-gray-500 mt-1">Manage assigned consignments and claim open delivery routes.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('assigned')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'assigned' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            My Assigned Jobs ({myJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'open' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Available Open Jobs ({openJobs.length})
          </button>
        </div>
      </div>

      {currentList.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-7 h-7" />}
          title={activeTab === 'assigned' ? 'No jobs assigned yet' : 'No open jobs available'}
          description={
            activeTab === 'assigned'
              ? 'Check the "Available Open Jobs" tab to claim a delivery, or wait for an operations coordinator to assign one.'
              : 'All paid transactions have active carriers assigned.'
          }
        />
      ) : (
        <div className="space-y-3">
          {currentList.map((j) => (
            <div
              key={j.id}
              onClick={() => navigate(activeTab === 'assigned' ? `/app/jobs/${j.id}` : `/app/assignments/${j.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-agri-400 transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-mono text-gray-400 mb-0.5">{j.id}</div>
                  <h3 className="font-semibold text-gray-900 text-base">{formatCommodity(j.commodity)}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">{j.quantity} {j.unit}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[j.status] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                    {j.status.replace(/_/g, ' ')}
                  </span>
                  {activeTab === 'open' && (
                    <button
                      type="button"
                      disabled={claiming === j.id}
                      onClick={(e) => handleClaim(j.id, e)}
                      className="flex items-center gap-1 px-3 py-1 bg-agri-700 hover:bg-agri-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      {claiming === j.id ? 'Claiming…' : 'Claim Job'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-700">
                <MapPin className="w-3.5 h-3.5 text-agri-600 shrink-0" />
                <span className="font-medium">{j.pickupLocation}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{j.deliveryLocation}</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-50">
                <span>Expected: <b>{formatDate(j.expectedDeliveryDate)}</b></span>
                <span>Carrier Fee: <b>{formatCurrency(j.logisticsCost, j.currency)}</b></span>
                <span className="font-mono">TXN: {j.transactionId}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
