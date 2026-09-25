import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, CreditCard,
  AlertTriangle, BookOpen,
} from 'lucide-react';
import { transactionService } from '../services/transactionService';
import { paymentService } from '../services/paymentService';
import { logisticsService } from '../services/logisticsService';
import { disputeService } from '../services/disputeService';
import { auditService } from '../services/auditService';
import { TRANSACTION_PIPELINE, getPipelineIndex, getStatusLabel } from '../services/transactionStateMachine';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { supplyService } from '../services/supplyService';
import { ListingMediaViewer } from '../components/ui/ListingMediaViewer';
import { formatCurrency, formatDate, formatDateTime, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import type { Transaction, TransactionStatus, Payment, LogisticsJob, AuditEvent, SupplyListing } from '../types';


function statusPill(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'status-pill status-pill-green',
    PENDING: 'status-pill status-pill-gray',
    PENDING_SUPPLIER_ACCEPTANCE: 'status-pill status-pill-gray',
    ACCEPTED: 'status-pill status-pill-blue',
    PAYMENT_PENDING: 'status-pill status-pill-amber',
    PAYMENT_CONFIRMED: 'status-pill status-pill-green',
    PAYMENT_FAILED: 'status-pill status-pill-red',
    PAYMENT_CANCELLED: 'status-pill status-pill-red',
    LOGISTICS_PENDING: 'status-pill status-pill-blue',
    LOGISTICS_ASSIGNED: 'status-pill status-pill-blue',
    LOGISTICS_ACCEPTED: 'status-pill status-pill-blue',
    READY_FOR_PICKUP: 'status-pill status-pill-blue',
    PICKED_UP: 'status-pill status-pill-blue',
    IN_TRANSIT: 'status-pill status-pill-blue',
    DELIVERED: 'status-pill status-pill-purple',
    BUYER_CONFIRMATION_PENDING: 'status-pill status-pill-purple',
    DISPUTED: 'status-pill status-pill-red',
    CANCELLED: 'status-pill status-pill-red',
    REJECTED: 'status-pill status-pill-red',
    DELIVERY_FAILED: 'status-pill status-pill-red',
  };
  return map[status] ?? 'status-pill status-pill-gray';
}

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, refreshNotifications } = useApp();
  const { toast } = useToast();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [listing, setListing] = useState<SupplyListing | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [job, setJob] = useState<LogisticsJob | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ reason: '', description: '' });
  const [payProcessing, setPayProcessing] = useState(false);

  const refresh = async () => {
    if (!id) return;
    let t = await transactionService.fetchById(id);
    if (t) {
      if (t.listingId) {
        const l = await supplyService.fetchById(t.listingId);
        setListing(l);
      }
      let p = paymentService.getForTransaction(t.id);
      const j = logisticsService.getForTransaction(t.id);

      if (searchParams.get('payment') === 'success' && session) {
        if (!p) {
          p = await paymentService.initiate({
            transactionId: t.id,
            payerId: session.userId,
            payerName: session.name,
            amount: t.totalAmount,
            currency: t.currency || 'NGN',
          });
        }
        if (p && p.status !== 'CONFIRMED') {
          await paymentService.confirm(p.id, session.userId, session.name);
          toast('success', 'Bachs.io Payment Confirmed! Funds are locked in escrow.');
          const updated = await transactionService.fetchById(id);
          if (updated) {
            t = updated;
            p = paymentService.getForTransaction(t.id);
          }
          refreshNotifications();
        }
      }

      if (j && t) {
        const logisticsToTxnStatus: Record<string, TransactionStatus> = {
          COMPLETED: 'COMPLETED',
          DELIVERED: 'DELIVERED',
          IN_TRANSIT: 'IN_TRANSIT',
          PICKED_UP: 'PICKED_UP',
          READY_FOR_PICKUP: 'READY_FOR_PICKUP',
          ACCEPTED: 'LOGISTICS_ACCEPTED',
          ASSIGNED: 'LOGISTICS_ASSIGNED',
        };
        const mappedStatus = logisticsToTxnStatus[j.status];
        if (mappedStatus && t.status !== mappedStatus && getPipelineIndex(mappedStatus) > getPipelineIndex(t.status)) {
          try {
            const updated = await transactionService.transition({
              transactionId: t.id,
              to: mappedStatus,
              actorId: j.providerId || session?.userId || 'system',
              actorName: j.providerName || session?.name || 'Logistics Provider',
              actorRole: 'logistics',
              note: `Synchronized with shipment status: ${j.status}`,
            });
            if (updated) t = updated;
          } catch {
            // fallback gracefully
          }
        }
      }

      if (t) {
        setTxn(t);
        setPayment(p);
        setJob(j);
        setAudit(auditService.getForTransaction(t.id));
      }
    }
  };

  useEffect(() => { refresh(); }, [id, searchParams]);

  if (!txn || !session) return (
    <div className="p-6 flex items-center justify-center text-gray-500">Transaction not found.</div>
  );

  const role = session.role;
  const isSupplier = role === 'supplier' && txn.supplierId === session.userId;
  const isBuyer = role === 'buyer' && txn.buyerId === session.userId;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await transactionService.transition({
        transactionId: txn.id, to: 'ACCEPTED',
        actorId: session.userId, actorName: session.name, actorRole: 'supplier',
        note: 'Supplier accepted the transaction.',
      });
      toast('success', 'Transaction accepted.');
      refreshNotifications();
      refresh();
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await transactionService.transition({
        transactionId: txn.id, to: 'REJECTED',
        actorId: session.userId, actorName: session.name, actorRole: 'supplier',
      });
      toast('info', 'Transaction rejected.');
      refreshNotifications();
      refresh();
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  const handlePay = async (simulate: 'success' | 'failure') => {
    setPayProcessing(true);
    setShowPayModal(false);
    try {
      const p = await paymentService.initiate({
        transactionId: txn.id, payerId: session.userId, payerName: session.name,
        amount: txn.totalAmount, currency: txn.currency,
      });
      toast('info', 'Processing payment...');
      refresh();
      if (simulate === 'success') {
        await paymentService.confirm(p.id, session.userId, session.name);
        toast('success', 'Payment confirmed! Logistics job created.');
      } else {
        await paymentService.fail(p.id, 'Insufficient funds (simulated).');
        toast('error', 'Payment failed: Insufficient funds (simulated).');
      }
      refreshNotifications();
      refresh();
    } catch (e: any) { toast('error', e.message); }
    finally { setPayProcessing(false); }
  };

  const handleConfirmDelivery = async () => {
    if (txn.status === 'COMPLETED') {
      toast('info', 'This transaction is already completed.');
      return;
    }
    if (txn.status !== 'DELIVERED' && txn.status !== 'BUYER_CONFIRMATION_PENDING') {
      toast('error', 'Delivery cannot be confirmed yet. The logistics provider must first mark the shipment as delivered.');
      return;
    }
    setLoading(true);
    try {
      await transactionService.transition({
        transactionId: txn.id, to: 'COMPLETED',
        actorId: session.userId, actorName: session.name, actorRole: 'buyer',
        note: 'Buyer confirmed receipt and completed the transaction.',
      });
      toast('success', 'Delivery confirmed! Transaction completed.');
      refreshNotifications();
      refresh();
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  const handleRaiseDispute = async () => {
    if (!disputeForm.reason || !disputeForm.description) { toast('error', 'Please provide a reason and description.'); return; }
    setLoading(true);
    try {
      await disputeService.raise({
        transactionId: txn.id, raisedById: session.userId, raisedByName: session.name,
        reason: disputeForm.reason, description: disputeForm.description,
      });
      toast('warning', 'Dispute raised. Our team will review shortly.');
      setShowDisputeModal(false);
      refreshNotifications();
      refresh();
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  const pipelineIdx = getPipelineIndex(txn.status);
  const terminalStates = ['COMPLETED', 'CANCELLED', 'REJECTED', 'DISPUTED'];
  const isTerminal = terminalStates.includes(txn.status);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <button type="button" onClick={() => navigate(-1)} className="mt-1 p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{txn.id}</h1>
            <span className={statusPill(txn.status)}>{txn.status.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">

            <span className="text-2xl">{COMMODITY_ICONS[txn.commodity]}</span>
            <span className="font-medium text-gray-800">{formatCommodity(txn.commodity)}</span>
            <span>·</span>
            <span>{txn.quantity} {txn.unit}</span>
            <span>·</span>
            <span className="font-semibold text-gray-900">{formatCurrency(txn.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Transaction progress timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Transaction Progress</h2>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {TRANSACTION_PIPELINE.map((step, idx) => {
            const done = pipelineIdx > idx || (txn.status === 'COMPLETED' && idx === TRANSACTION_PIPELINE.length - 1);
            const current = !isTerminal && pipelineIdx === idx;
            return (
              <div key={step} className="flex items-center gap-0 shrink-0">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all
                    ${done ? 'bg-gray-900 border-gray-900 text-white' : current ? 'bg-white border-gray-900 text-gray-900' : 'bg-white border-gray-300 text-gray-400'}`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : current ? <Circle className="w-3.5 h-3.5 fill-gray-600" /> : <Circle className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`text-[9px] mt-1 text-center max-w-[60px] leading-tight font-medium
                    ${done ? 'text-gray-700' : current ? 'text-gray-600' : 'text-gray-400'}`}>
                    {getStatusLabel(step)}
                  </div>
                </div>
                {idx < TRANSACTION_PIPELINE.length - 1 && (
                  <div className={`h-0.5 w-8 mx-1 ${pipelineIdx > idx ? 'bg-gray-500' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
        {isTerminal && !['COMPLETED'].includes(txn.status) && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700 font-medium">Transaction ended: <strong>{getStatusLabel(txn.status)}</strong></p>
          </div>
        )}
      </div>

      {/* Action area */}
      <div className="space-y-3">
        {isSupplier && txn.status === 'PENDING' && (
          <div className="px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">Action Required</p>
              <p className="text-xs text-amber-700">{txn.buyerName} has requested this transaction. Please review and respond.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleReject}
                className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleAccept}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                Accept Transaction
              </button>
            </div>
          </div>
        )}

        {isBuyer && txn.status === 'ACCEPTED' && (
          <div className="px-4 py-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">Payment Required</p>
              <p className="text-xs text-blue-700">Supplier has accepted. Initiate payment to proceed to logistics.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPayModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pay {formatCurrency(txn.totalAmount)}
            </button>
          </div>
        )}

        {isBuyer && txn.status === 'PAYMENT_FAILED' && (
          <div className="px-4 py-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-900">Payment Failed</p>
              <p className="text-xs text-red-700">{payment?.failureReason ?? 'The payment could not be processed.'}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPayModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Retry Payment
            </button>
          </div>
        )}

        {payProcessing && (
          <div className="px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            <p className="text-sm text-gray-700">Processing payment...</p>
          </div>
        )}

        {isBuyer && txn.status === 'DELIVERED' && (
          <div className="px-4 py-4 bg-teal-50 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-900">Shipment Delivered — Confirm Receipt</p>
              <p className="text-xs text-teal-700">The logistics provider has marked this shipment as delivered. Please confirm you received it.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDisputeModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Report Issue
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDelivery}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm Delivery
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Commercial Terms */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Commercial Terms</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Commodity', value: formatCommodity(txn.commodity) },
                { label: 'Quantity', value: `${txn.quantity} ${txn.unit}` },
                { label: 'Quality Grade', value: `Grade ${txn.qualityGrade}` },
                { label: 'Price per Unit', value: formatCurrency(txn.pricePerUnit) },
                { label: 'Total Value', value: <span className="font-bold text-gray-900">{formatCurrency(txn.totalAmount)}</span> },
                { label: 'Currency', value: txn.currency },
                { label: 'Pickup Location', value: txn.pickupLocation },
                { label: 'Delivery Location', value: txn.deliveryLocation },
                { label: 'Expected Delivery', value: formatDate(txn.expectedDeliveryDate) },
                { label: 'Initiated', value: formatDateTime(txn.createdAt) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <ListingMediaViewer
            media={listing?.media}
            photos={listing?.photos}
            videos={listing?.videos}
            inspectionDetails={listing?.inspectionDetails}
            commodityTitle={formatCommodity(txn.commodity)}
            qualityGrade={txn.qualityGrade}
            supplierName={txn.supplierName}
          />

          {/* Parties */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Parties</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Buyer</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                    {txn.buyerName[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{txn.buyerName}</div>
                    <div className="text-xs text-gray-500">{txn.deliveryLocation}</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Supplier</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 font-bold text-sm">
                    {txn.supplierName[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{txn.supplierName}</div>
                    <div className="text-xs text-gray-500">{txn.pickupLocation}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment */}
          {payment && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Payment</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><div className="text-xs text-gray-500 mb-0.5">Payment ID</div><div className="text-sm font-mono text-gray-700">{payment.id}</div></div>
                <div><div className="text-xs text-gray-500 mb-0.5">Amount</div><div className="text-sm font-bold text-gray-900">{formatCurrency(payment.amount)}</div></div>
                <div><div className="text-xs text-gray-500 mb-0.5">Provider</div><div className="text-sm text-gray-700">{payment.provider}</div></div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Status</div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border inline-block
                    ${payment.status === 'CONFIRMED' ? 'bg-green-50 border-green-200 text-green-700' :
                      payment.status === 'FAILED' ? 'bg-red-50 border-red-200 text-red-700' :
                      'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    {payment.status}
                  </span>
                </div>
                {payment.providerReference && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-gray-500 mb-0.5">Provider Reference</div>
                    <div className="text-sm font-mono text-gray-700">{payment.providerReference}</div>
                  </div>
                )}
                {payment.completedAt && (
                  <div><div className="text-xs text-gray-500 mb-0.5">Confirmed at</div><div className="text-sm text-gray-700">{formatDateTime(payment.completedAt)}</div></div>
                )}
                {payment.failureReason && (
                  <div className="sm:col-span-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-xs text-red-700">{payment.failureReason}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logistics */}
          {job && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Logistics</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><div className="text-xs text-gray-500 mb-0.5">Job ID</div><div className="text-sm font-mono text-gray-700">{job.id}</div></div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Status</div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 inline-block">
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div><div className="text-xs text-gray-500 mb-0.5">Provider</div><div className="text-sm text-gray-700">{job.providerName ?? <span className="text-gray-400 italic">Not yet assigned</span>}</div></div>
                <div><div className="text-xs text-gray-500 mb-0.5">Logistics Cost</div><div className="text-sm text-gray-700">{formatCurrency(job.logisticsCost)}</div></div>
                <div><div className="text-xs text-gray-500 mb-0.5">Pickup</div><div className="text-sm text-gray-700">{job.pickupLocation}</div></div>
                <div><div className="text-xs text-gray-500 mb-0.5">Destination</div><div className="text-sm text-gray-700">{job.deliveryLocation}</div></div>
                <div><div className="text-xs text-gray-500 mb-0.5">Expected Delivery</div><div className="text-sm text-gray-700">{formatDate(job.expectedDeliveryDate)}</div></div>
                {job.proofOfDelivery && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-gray-500 mb-1">Proof of Delivery</div>
                    <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                      <div className="font-medium text-gray-800">Received by: {job.proofOfDelivery.recipientName}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{job.proofOfDelivery.deliveryNote}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatDateTime(job.proofOfDelivery.timestamp)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Audit trail */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs sticky top-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-500" />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Audit Trail</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {audit.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-gray-400">No audit events yet</div>
              ) : (
                <div className="px-5 py-4">
                  <div className="relative">
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-100" />
                    <div className="space-y-4">
                      {audit.map((ev) => (
                        <div key={ev.id} className="relative pl-6">
                          <div className="absolute left-0 top-1 w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded-full" />
                          <div className="text-[10px] text-gray-400 mb-0.5">{formatDateTime(ev.createdAt)}</div>
                          <div className="text-xs font-medium text-gray-800">{ev.actorName}</div>
                          <div className="text-xs text-gray-600">{ev.detail ?? ev.action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pay modal */}
      {showPayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPayModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Complete Escrow Payment</h2>
              <button type="button" onClick={() => setShowPayModal(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 text-lg leading-none">✕</button>
            </div>
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
              <strong>Escrow Protection</strong> — Funds are secured by AgriFlow and only released after delivery confirmation.
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Transaction</div>
              <div className="font-mono text-sm font-medium text-gray-800">{txn.id}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Amount</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(txn.totalAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Provider</div>
              <div className="text-sm text-gray-800">AgriFlow Escrow Settlement</div>
            </div>
            <button
              type="button"
              onClick={() => handlePay('success')}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
            >
              <CreditCard className="w-4 h-4" />
              Confirm Payment {formatCurrency(txn.totalAmount)}
            </button>
          </div>
        </div>
      )}

      {/* Dispute modal */}
      {showDisputeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowDisputeModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Report Issue</h2>
              <button type="button" onClick={() => setShowDisputeModal(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 text-lg leading-none">✕</button>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Wrong quantity delivered"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"
                  value={disputeForm.description}
                  onChange={(e) => setDisputeForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="Describe the issue in detail..."
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleRaiseDispute}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
