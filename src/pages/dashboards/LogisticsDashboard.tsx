import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ClipboardList, CheckCircle2, Package, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { logisticsService } from '../../services/logisticsService';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate, formatCommodity } from '../../utils/format';
import { EscrowEarningsCard } from '../../components/wallet/EscrowEarningsCard';
import type { LogisticsJob } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-700 bg-amber-50 border-amber-200',
  ASSIGNED: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  ACCEPTED: 'text-blue-700 bg-blue-50 border-blue-200',
  READY_FOR_PICKUP: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  PICKED_UP: 'text-sky-700 bg-sky-50 border-sky-200',
  IN_TRANSIT: 'text-violet-700 bg-violet-50 border-violet-200',
  DELIVERED: 'text-teal-700 bg-teal-50 border-teal-200',
  COMPLETED: 'text-agri-700 bg-agri-50 border-agri-200',
};

export function LogisticsDashboard() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  if (!session) return null;

  const myJobs = logisticsService.getForProvider(session.userId);
  const newAssigned = myJobs.filter((j) => j.status === 'ASSIGNED');
  const active = myJobs.filter((j) => ['ACCEPTED','READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT'].includes(j.status));
  const delivered = myJobs.filter((j) => j.status === 'DELIVERED');
  const completed = myJobs.filter((j) => j.status === 'COMPLETED');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistics Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{session.name} · Operations centre</p>
        </div>
        <Button variant="outline" icon={<ClipboardList className="w-4 h-4" />} onClick={() => navigate('/app/jobs')}>
          All Jobs
        </Button>
      </div>

      {/* Escrow Earnings & Withdrawal Payouts */}
      <EscrowEarningsCard
        userId={session.userId}
        userName={session.name}
        userRole="logistics"
        onUpdated={() => setTick((t) => t + 1)}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'New Assignments', value: newAssigned.length, color: 'bg-indigo-50 border-indigo-200 text-indigo-900', icon: <ClipboardList className="w-4 h-4" /> },
          { label: 'Active Shipments', value: active.length, color: 'bg-blue-50 border-blue-200 text-blue-900', icon: <Truck className="w-4 h-4" /> },
          { label: 'Delivered', value: delivered.length, color: 'bg-teal-50 border-teal-200 text-teal-900', icon: <MapPin className="w-4 h-4" /> },
          { label: 'Completed', value: completed.length, color: 'bg-agri-50 border-agri-200 text-agri-900', icon: <CheckCircle2 className="w-4 h-4" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 border ${s.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium opacity-80">{s.label}</span>
              <div className="opacity-60">{s.icon}</div>
            </div>
            <div className="text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* New assignments alert */}
      {newAssigned.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-medium text-indigo-800">
              {newAssigned.length} new job{newAssigned.length > 1 ? 's' : ''} assigned — requires your response
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/app/jobs')}>View Jobs</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* New assignments */}
        <Card>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">New Assignments</h2>
          </div>
          <CardContent className="p-0">
            {newAssigned.length === 0 ? (
              <EmptyState icon={<Package className="w-7 h-7" />} title="No new assignments" description="New jobs will appear here when assigned by operations." />
            ) : (
              <div className="divide-y divide-gray-50">
                {newAssigned.map((j) => <JobCard key={j.id} job={j} onClick={() => navigate(`/app/jobs/${j.id}`)} />)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active shipments */}
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Active Shipments</h2>
            <button onClick={() => navigate('/app/shipments')} className="text-xs text-agri-600 font-medium hover:text-agri-700">View all</button>
          </div>
          <CardContent className="p-0">
            {active.length === 0 ? (
              <EmptyState icon={<Truck className="w-7 h-7" />} title="No active shipments" />
            ) : (
              <div className="divide-y divide-gray-50">
                {active.map((j) => <JobCard key={j.id} job={j} onClick={() => navigate(`/app/jobs/${j.id}`)} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function JobCard({ job, onClick }: { job: LogisticsJob; onClick: () => void }) {
  const colorClass = STATUS_COLORS[job.status] ?? 'text-gray-700 bg-gray-50 border-gray-200';
  return (
    <div onClick={onClick} className="px-5 py-4 hover:bg-gray-50 cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs font-mono text-gray-400 mb-0.5">{job.id}</div>
          <div className="text-sm font-semibold text-gray-800">{formatCommodity(job.commodity)}</div>
          <div className="text-xs text-gray-500">{job.quantity} {job.unit}</div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${colorClass}`}>
          {job.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <MapPin className="w-3 h-3" />
        <span>{job.pickupLocation} → {job.deliveryLocation}</span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">
        Expected: {formatDate(job.expectedDeliveryDate)} · {formatCurrency(job.logisticsCost)}
      </div>
    </div>
  );
}
