import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ClipboardList, CheckCircle2, Package, MapPin, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { logisticsService } from '../../services/logisticsService';
import { formatCurrency, formatDate, formatCommodity } from '../../utils/format';
import { EscrowEarningsCard } from '../../components/wallet/EscrowEarningsCard';
import type { LogisticsJob } from '../../types';

function greeting(name: string) {
  const h = new Date().getHours();
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${time}, ${name.split(' ')[0]}.`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-700 bg-amber-50 border-amber-200',
  ASSIGNED: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  ACCEPTED: 'text-blue-700 bg-blue-50 border-blue-200',
  READY_FOR_PICKUP: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  PICKED_UP: 'text-sky-700 bg-sky-50 border-sky-200',
  IN_TRANSIT: 'text-violet-700 bg-violet-50 border-violet-200',
  DELIVERED: 'text-teal-700 bg-teal-50 border-teal-200',
  COMPLETED: 'text-green-700 bg-green-50 border-green-200',
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

  const priorityOrder = ['ASSIGNED','ACCEPTED','READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT','DELIVERED','COMPLETED','FAILED'];
  const recentJobs = [...myJobs]
    .sort((a, b) => priorityOrder.indexOf(a.status) - priorityOrder.indexOf(b.status))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting(session.name)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {myJobs.length} total job{myJobs.length !== 1 ? 's' : ''} · {active.length} active shipment{active.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/jobs')}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-xs"
        >
          <ClipboardList size={15} />
          All Jobs
        </button>
      </div>

      {/* Escrow Earnings */}
      <EscrowEarningsCard
        userId={session.userId}
        userName={session.name}
        userRole="logistics"
        onUpdated={() => setTick(t => t + 1)}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'New Assignments', value: newAssigned.length, dot: 'bg-indigo-500' },
          { label: 'Active Shipments', value: active.length, dot: 'bg-blue-500' },
          { label: 'Delivered', value: delivered.length, dot: 'bg-teal-500' },
          { label: 'Completed', value: completed.length, dot: 'bg-green-500' },
        ].map(({ label, value, dot }) => (
          <div key={label} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              <div className="text-xs text-gray-500 font-medium">{label}</div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {/* New assignment alert */}
      {newAssigned.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-indigo-600 shrink-0" />
            <p className="text-sm font-medium text-indigo-800">
              {newAssigned.length} new job{newAssigned.length > 1 ? 's' : ''} assigned — action required
            </p>
          </div>
          <button
            onClick={() => navigate('/app/jobs')}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 whitespace-nowrap flex items-center gap-1"
          >
            Review <ArrowRight size={11} />
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* New Assignments */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">New Assignments</h2>
            {newAssigned.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {newAssigned.length} new
              </span>
            )}
          </div>
          {newAssigned.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Package size={28} className="mx-auto text-gray-300 mb-2" />
              <div className="text-sm text-gray-400">No new assignments</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {newAssigned.map(j => (
                <JobRow key={j.id} job={j} onClick={() => navigate(`/app/jobs/${j.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Active Shipments */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Active Shipments</h2>
            <button onClick={() => navigate('/app/shipments')} className="text-xs text-gray-500 font-semibold hover:text-gray-900">
              View all →
            </button>
          </div>
          {active.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Truck size={28} className="mx-auto text-gray-300 mb-2" />
              <div className="text-sm text-gray-400">No active shipments</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {active.map(j => (
                <JobRow key={j.id} job={j} onClick={() => navigate(`/app/jobs/${j.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent jobs table */}
      {recentJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">All Recent Jobs</h2>
            <button onClick={() => navigate('/app/jobs')} className="text-xs font-semibold text-gray-600 hover:text-gray-900">
              View all →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-medium">
                <tr>
                  <th className="px-5 py-3">Job ID</th>
                  <th className="px-5 py-3">Commodity</th>
                  <th className="px-5 py-3">Route</th>
                  <th className="px-5 py-3">Pay</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {recentJobs.map(j => {
                  const colorClass = STATUS_COLORS[j.status] ?? 'text-gray-700 bg-gray-50 border-gray-200';
                  return (
                    <tr
                      key={j.id}
                      onClick={() => navigate(`/app/jobs/${j.id}`)}
                      className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono text-gray-500">{j.id}</td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{formatCommodity(j.commodity)}</td>
                      <td className="px-5 py-3.5 text-gray-500 max-w-[180px] truncate">
                        {j.pickupLocation} → {j.deliveryLocation}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{formatCurrency(j.logisticsCost)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
                          {j.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function JobRow({ job, onClick }: { job: LogisticsJob; onClick: () => void }) {
  const colorClass = STATUS_COLORS[job.status] ?? 'text-gray-700 bg-gray-50 border-gray-200';
  return (
    <div onClick={onClick} className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="text-xs font-mono text-gray-400">{job.id}</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">
            {formatCommodity(job.commodity)} · {job.quantity} {job.unit}
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${colorClass}`}>
          {job.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <MapPin size={11} className="shrink-0" />
        <span className="truncate">{job.pickupLocation} → {job.deliveryLocation}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
        <CheckCircle2 size={11} className="text-green-500" />
        <span>{formatDate(job.expectedDeliveryDate)}</span>
        <span className="font-semibold text-gray-700">{formatCurrency(job.logisticsCost)}</span>
      </div>
    </div>
  );
}
