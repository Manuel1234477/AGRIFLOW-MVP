import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { logisticsService } from '../services/logisticsService';
import { formatCurrency, formatCommodity } from '../utils/format';
import type { LogisticsJob } from '../types';

export function LogisticsAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [acting, setActing] = useState(false);
  const [job, setJob] = useState<LogisticsJob | null>(null);

  useEffect(() => {
    if (!session) return;
    const providerJobs = logisticsService.getForProvider(session.userId);
    let current: LogisticsJob | null = null;
    if (id) {
      current = logisticsService.getById(id);
    } else {
      current = providerJobs.find((j) => j.status === 'ASSIGNED' || j.status === 'PENDING') || providerJobs[0] || logisticsService.getAll()[0] || null;
    }
    setJob(current);
  }, [id, session]);

  const handleAccept = async () => {
    if (!session || !job) return;
    setActing(true);
    try {
      await logisticsService.acceptJob(job.id, session.userId, session.name);
      setJob({ ...job, status: 'ACCEPTED' });
      toast('success', `Assignment ${job.id} accepted! Job moved to active shipments.`);
      setTimeout(() => {
        navigate('/app/shipments');
      }, 1000);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to accept job.');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!session || !job) return;
    setActing(true);
    try {
      await logisticsService.rejectJob(job.id, 'Capacity unavailable for required window', session.userId, session.name);
      setJob({ ...job, status: 'REJECTED' });
      toast('info', `Job assignment ${job.id} rejected.`);
      setTimeout(() => {
        navigate('/app/jobs');
      }, 1000);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to reject job.');
    } finally {
      setActing(false);
    }
  };

  const isPendingAssignment = !job || job.status === 'ASSIGNED' || job.status === 'PENDING';
  const pickup = job?.pickupLocation || 'Ogbomoso, Oyo State';
  const delivery = job?.deliveryLocation || 'Ikeja, Lagos';
  const commodity = job?.commodity || 'maize';
  const quantity = job?.quantity || 12;
  const unit = job?.unit || 'tonnes';
  const cost = job?.logisticsCost || 185000;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/app/jobs"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          ← Back to Assignments
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Job assignment</h1>
          <p className="text-xs text-gray-500 mt-1">
            {job?.id || 'JOB-8871'} · {job?.transactionId || 'TXN-4821'} · Assigned by Operations
          </p>
        </div>
        <div>
          <span className={`status-pill ${isPendingAssignment ? 'status-pill-gray' : 'status-pill-green'}`}>
            {job?.status || 'LOGISTICS_ASSIGNED'}
          </span>
        </div>
      </div>

      {/* Expiry Banner */}
      {isPendingAssignment && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-800 flex items-center gap-2">
          <span>⏰</span>
          <span className="font-medium">New Transport Job: Review route, cargo specifications, and accept to proceed with pickup.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Route & Cargo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Route Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Route Details
            </h2>

            <div className="relative pl-6 space-y-6 border-l-2 border-dashed border-gray-200 ml-2">
              {/* Pickup Point */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-800" />
                <div className="text-xs text-gray-500 font-medium">Pickup location</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{pickup}</div>
                <div className="text-xs text-gray-500 mt-0.5">Supplier: Adeyemi Produce Co.</div>
              </div>

              {/* Delivery Point */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-gray-900 border-2 border-gray-900" />
                <div className="text-xs text-gray-500 font-medium">Delivery location</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{delivery}</div>
                <div className="text-xs text-gray-500 mt-0.5">Recipient: Kola Farms Ltd · Lagos Warehouse</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100 text-xs">
              <div>
                <div className="text-gray-500">Estimated distance</div>
                <div className="font-semibold text-gray-900 mt-0.5">~142 km</div>
              </div>
              <div>
                <div className="text-gray-500">Target Delivery Date</div>
                <div className="font-semibold text-gray-900 mt-0.5">
                  {job?.expectedDeliveryDate ? new Date(job.expectedDeliveryDate).toLocaleDateString() : '8 Sep 2026'}
                </div>
              </div>
            </div>
          </div>

          {/* Cargo Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Cargo specifications
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-gray-500">Commodity</div>
                <div className="font-semibold text-gray-900 mt-0.5">{formatCommodity(commodity)}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Quantity</div>
                <div className="font-semibold text-gray-900 mt-0.5">{quantity} {unit}</div>
              </div>
              <div>
                <div className="text-gray-500">Packaging</div>
                <div className="font-semibold text-gray-900 mt-0.5">50kg standard sacks</div>
              </div>
              <div>
                <div className="text-gray-500">Recommended Vehicle</div>
                <div className="font-semibold text-gray-900 mt-0.5">15-Tonne Rigid Flatbed / Covered</div>
              </div>
              <div>
                <div className="text-gray-500">Handling instructions</div>
                <div className="font-semibold text-gray-900 mt-0.5">Moisture sensitive · Tarpaulin required</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payout & Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Transport Payout
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Agreed Logistics Fee</span>
                <span className="font-medium text-gray-900">{formatCurrency(cost)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Escrow Guarantee</span>
                <span className="text-emerald-700 font-medium">100% Secured</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total Payout</span>
                <span className="text-emerald-700">{formatCurrency(cost)}</span>
              </div>
            </div>

            {isPendingAssignment ? (
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={acting}
                  onClick={handleAccept}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {acting ? 'Processing...' : 'Accept assignment'}
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={handleReject}
                  className="w-full py-2.5 px-4 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  Decline job
                </button>
              </div>
            ) : (
              <div className="pt-2 text-center text-xs font-semibold text-gray-900 bg-green-50 p-2.5 rounded-lg border border-green-200">
                Job Status: {job?.status?.replace(/_/g, ' ')}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-2">
            <h3 className="text-xs font-semibold text-gray-700">Next Steps</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Upon accepting, navigate to Active Deliveries to mark cargo as <strong>Ready for Pickup</strong>, <strong>Picked Up</strong>, and track through to delivery confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
