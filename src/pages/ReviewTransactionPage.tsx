import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { transactionService } from '../services/transactionService';
import { supplyService } from '../services/supplyService';
import { ListingMediaViewer } from '../components/ui/ListingMediaViewer';
import { formatCommodity, formatCurrency } from '../utils/format';
import type { SupplyListing } from '../types';

export function ReviewTransactionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [listing, setListing] = useState<SupplyListing | null>(null);

  useEffect(() => {
    if (!id) return;
    const targetId = id;
    let isMounted = true;
    async function load() {
      const l = await supplyService.fetchById(targetId);
      if (isMounted) setListing(l);
    }
    load();
    return () => { isMounted = false; };
  }, [id]);

  const supplierName = listing?.supplierName || 'Adeyemi Produce Co.';
  const pickupLocation = listing?.location || 'Ogbomoso, Oyo State';
  const unitPrice = listing?.pricePerUnit || 480000;
  const quantity = listing?.quantity || 12;
  const currency = listing?.currency || 'NGN';
  const goodsSubtotal = unitPrice * quantity;
  const logisticsCost = Math.round(goodsSubtotal * 0.035);
  const platformFee = Math.round(goodsSubtotal * 0.01);
  const totalDue = goodsSubtotal + logisticsCost + platformFee;

  const handleSendRequest = async () => {
    if (!session || !listing) return;
    setSending(true);
    try {
      const tx = await transactionService.create({
        listing,
        buyerId: session.userId,
        buyerName: session.name,
        quantity,
        deliveryLocation: 'Lagos, Nigeria',
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      });

      toast('success', `Trade order ${tx.id} created! Supplier will accept before payment.`);
      navigate(`/app/transactions/${tx.id}`);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to send request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/app/matches"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          ← Back to Match Results
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Review transaction</h1>
        <p className="text-xs text-gray-500 mt-1">
          Check the terms before sending this request. The supplier must accept before payment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Details Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Supplier Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Supplier
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-700">
                {supplierName.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{supplierName}</div>
                <div className="text-xs text-gray-500">
                  {pickupLocation} · Verified supplier · 34 completed transactions
                </div>
              </div>
            </div>
          </div>

            {/* Goods Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Goods
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-gray-500">Commodity</div>
                <div className="font-semibold text-gray-900 mt-0.5">{listing ? formatCommodity(listing.commodity) : 'Commodity'}</div>
              </div>
              <div>
                <div className="text-gray-500">Grade</div>
                <div className="font-semibold text-gray-900 mt-0.5">{listing ? `Grade ${listing.qualityGrade}` : 'Grade A'}</div>
              </div>
              <div>
                <div className="text-gray-500">Quantity</div>
                <div className="font-semibold text-gray-900 mt-0.5">{quantity} {listing?.unit || 'tonnes'}</div>
              </div>
              <div>
                <div className="text-gray-500">Unit price</div>
                <div className="font-semibold text-gray-900 mt-0.5">{formatCurrency(unitPrice, currency)} / {listing?.unit || 'tonne'}</div>
              </div>
            </div>
          </div>

          {/* Supplier Media & Batch Inspection Verification */}
          <ListingMediaViewer
            media={listing?.media}
            photos={listing?.photos}
            videos={listing?.videos}
            inspectionDetails={listing?.inspectionDetails}
            commodityTitle={listing ? formatCommodity(listing.commodity) : 'Produce'}
            qualityGrade={listing?.qualityGrade}
            supplierName={supplierName}
          />

          {/* Logistics & Delivery Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Logistics &amp; delivery
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Pickup location</span>
                <span className="font-medium text-gray-900">{pickupLocation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Delivery location</span>
                <span className="font-medium text-gray-900">Lagos, Nigeria</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Estimated delivery</span>
                <span className="font-medium text-gray-900">3–4 days after pickup</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Logistics provider</span>
                <span className="font-medium text-gray-900">Assigned by AgriFlow after payment</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Cost Summary & Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Cost summary
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Goods subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(goodsSubtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Logistics</span>
                <span className="font-medium text-gray-900">{formatCurrency(logisticsCost, currency)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Platform fee</span>
                <span className="font-medium text-gray-900">{formatCurrency(platformFee, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total due</span>
                <span>{formatCurrency(totalDue, currency)}</span>
              </div>
            </div>
          </div>

          {/* After You Send This Notice */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-700">After you send this</h3>
            <div>
              <span className="status-pill status-pill-gray">PENDING_SUPPLIER_ACCEPTANCE</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              The supplier reviews and accepts or rejects. Payment is only requested after acceptance.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={sending}
              onClick={handleSendRequest}
              className="w-full py-2.5 px-4 text-xs font-medium text-white bg-agri-700 hover:bg-agri-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              {sending ? 'Sending request...' : 'Send request to supplier'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/matches')}
              className="w-full py-2.5 px-4 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
            >
              Choose a different supplier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
