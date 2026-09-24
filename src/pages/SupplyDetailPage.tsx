import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, CheckCircle2, XCircle, ArrowRightLeft } from 'lucide-react';
import { supplyService } from '../services/supplyService';
import { demandService } from '../services/demandService';
import { matchingService } from '../services/matchingService';
import { transactionService } from '../services/transactionService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { VerifiedBadge } from '../components/ui/VerifiedBadge';
import { ListingMediaViewer } from '../components/ui/ListingMediaViewer';
import { formatCurrency, formatDate, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import type { SupplyListing, DemandRequest, Match } from '../types';

export function SupplyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, refreshNotifications } = useApp();
  const { toast } = useToast();
  const [listing, setListing] = useState<SupplyListing | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finding, setFinding] = useState(false);
  const [txnForm, setTxnForm] = useState({
    quantity: '', deliveryLocation: session?.role === 'buyer' ? '' : '', expectedDeliveryDate: '',
  });
  const [myDemands, setMyDemands] = useState<DemandRequest[]>([]);

  useEffect(() => {
    if (!id) return;
    const targetId = id;
    let isMounted = true;
    async function load() {
      const l = await supplyService.fetchById(targetId);
      if (!isMounted) return;
      setListing(l);
      if (l && session && session.role === 'buyer') {
        const demands = (await demandService.fetchMine()).filter((d) => d.commodity === l.commodity);
        if (isMounted) {
          setMyDemands(demands);
          if (demands.length > 0) {
            const d = demands[0];
            setTxnForm({ quantity: String(d.quantity), deliveryLocation: d.destinationLocation, expectedDeliveryDate: d.requiredByDate ? d.requiredByDate.slice(0, 10) : '' });
          }
        }
      }
    }
    load();
    return () => { isMounted = false; };
  }, [id, session]);

  const findMatches = async () => {
    if (!listing || !session) return;
    setFinding(true);
    try {
      const demands = demandService.getForBuyer(session.userId).filter((d) => d.commodity === listing.commodity);
      if (demands.length === 0) {
        toast('info', 'Create a demand request first to see compatibility matches.');
        navigate('/app/demands/new');
        return;
      }
      const found: Match[] = [];
      for (const d of demands) {
        const res = await matchingService.findMatchesForDemand(d);
        found.push(...res.filter((m) => m.listingId === listing.id));
      }
      setMatches(found);
      if (found.length === 0) toast('info', 'No strong matches found. Your demand requirements may differ from this listing.');
    } catch (e: any) { toast('error', e.message); }
    finally { setFinding(false); }
  };

  const handleStartTransaction = async () => {
    if (!listing || !session || !txnForm.quantity || !txnForm.deliveryLocation || !txnForm.expectedDeliveryDate) {
      toast('error', 'Please fill in all required fields.');
      return;
    }
    const qty = Number(txnForm.quantity);
    if (qty > listing.quantity) {
      toast('error', `Only ${listing.quantity} ${listing.unit} available.`);
      return;
    }
    setLoading(true);
    try {
      const demand = myDemands.find((d) => d.commodity === listing.commodity);
      const txn = await transactionService.create({
        listing,
        demand,
        buyerId: session.userId,
        buyerName: session.name,
        quantity: qty,
        deliveryLocation: txnForm.deliveryLocation,
        expectedDeliveryDate: new Date(txnForm.expectedDeliveryDate).toISOString(),
      });
      toast('success', `Transaction ${txn.id} initiated.`);
      refreshNotifications();
      setShowTxnModal(false);
      navigate(`/app/transactions/${txn.id}`);
    } catch (e: any) { toast('error', e.message); }
    finally { setLoading(false); }
  };

  if (!listing) return <div className="p-6 text-gray-500">Listing not found.</div>;

  const bestMatch = matches.length > 0 ? matches[0] : null;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Supply Detail</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main listing */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-5xl">{COMMODITY_ICONS[listing.commodity] ?? '🌾'}</div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{formatCommodity(listing.commodity)}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500">Grade {listing.qualityGrade}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs font-mono text-gray-400">{listing.id}</span>
                    </div>
                  </div>
                </div>
                <VerifiedBadge verified={listing.supplierVerified} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="px-3 py-3 bg-green-50 rounded-xl">
                  <div className="text-xs text-gray-400 mb-0.5">Price per unit</div>
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(listing.pricePerUnit)}</div>
                  <div className="text-xs text-gray-500">per {listing.unit}</div>
                </div>
                <div className="px-3 py-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-0.5">Available quantity</div>
                  <div className="text-lg font-bold text-gray-800">{listing.quantity}</div>
                  <div className="text-xs text-gray-500">{listing.unit}</div>
                </div>
                <div className="px-3 py-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-0.5">Total value</div>
                  <div className="text-lg font-bold text-gray-800">{formatCurrency(listing.quantity * listing.pricePerUnit)}</div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {listing.location}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Available from {formatDate(listing.availabilityDate)}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Description</div>
                <p className="text-sm text-gray-700 leading-relaxed">{listing.description}</p>
              </div>
          </div>

          {/* Media & Inspection Proof */}
          <ListingMediaViewer
            media={listing.media}
            photos={listing.photos}
            videos={listing.videos}
            inspectionDetails={listing.inspectionDetails}
            commodityTitle={formatCommodity(listing.commodity)}
            qualityGrade={listing.qualityGrade}
            supplierName={listing.supplierName}
            isVerifiedSupplier={listing.supplierVerified}
          />

          {/* Supplier */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="font-semibold text-gray-800 mb-3">Supplier</h2>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-lg">
                {listing.supplierName[0]}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{listing.supplierName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <VerifiedBadge verified={listing.supplierVerified} />
                  <span className="text-xs text-gray-500">{listing.location}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Match card */}
          {bestMatch && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <div className="text-center mb-3">
                <div className="text-3xl font-bold text-gray-900">{bestMatch.score}%</div>
                <div className="text-xs text-gray-500 font-medium">Match Score</div>
                <div className="text-[10px] text-gray-400">Rule-based compatibility match</div>
              </div>
              <div className="space-y-1.5">
                {bestMatch.factors.map((f) => (
                  <div key={f.label} className="flex items-start gap-2">
                    {f.matched ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0" />}
                    <div>
                      <div className="text-xs font-medium text-gray-700">{f.label}</div>
                      {f.detail && <div className="text-[10px] text-gray-500">{f.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {session?.role === 'buyer' && (
            <div className="space-y-2">
              {!bestMatch && (
                <button
                  type="button"
                  disabled={finding}
                  onClick={findMatches}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  {finding ? 'Checking…' : 'Check Compatibility'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTxnModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Start Transaction
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transaction modal */}
      {showTxnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowTxnModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Initiate Transaction</h2>
              <button type="button" onClick={() => setShowTxnModal(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 text-lg leading-none">✕</button>
            </div>
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-gray-900">
              Supplier: <strong>{listing.supplierName}</strong> · {formatCommodity(listing.commodity)} · Grade {listing.qualityGrade}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                required
                value={txnForm.quantity}
                onChange={(e) => setTxnForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder={String(listing.quantity)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Max {listing.quantity} {listing.unit}</p>
            </div>
            <div className="text-sm text-gray-600">
              Unit price: {formatCurrency(listing.pricePerUnit)} / {listing.unit}
              {txnForm.quantity && (
                <span className="ml-2 font-semibold text-gray-900">
                  Total: {formatCurrency(Number(txnForm.quantity) * listing.pricePerUnit)}
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Location <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={txnForm.deliveryLocation}
                onChange={(e) => setTxnForm((f) => ({ ...f, deliveryLocation: e.target.value }))}
                placeholder="e.g. Abuja, Nigeria"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Required Delivery Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={txnForm.expectedDeliveryDate}
                onChange={(e) => setTxnForm((f) => ({ ...f, expectedDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowTxnModal(false)} className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">Cancel</button>
              <button
                type="button"
                disabled={loading}
                onClick={handleStartTransaction}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? 'Initiating…' : <><ArrowRightLeft className="w-3.5 h-3.5" />Initiate Transaction</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
