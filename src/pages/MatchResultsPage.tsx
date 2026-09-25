import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import { useApp } from '../context/AppContext';
import { demandService } from '../services/demandService';
import { supplyService } from '../services/supplyService';
import { matchingService } from '../services/matchingService';
import { formatCurrency, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import { VerifiedBadge } from '../components/ui/VerifiedBadge';
import { CheckCircle2, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import type { DemandRequest, SupplyListing, Match } from '../types';

interface DisplayMatch {
  listing: SupplyListing;
  match: Match | null;
  score: number;
}

export function MatchResultsPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const demandId = id || searchParams.get('demand') || undefined;

  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [demands, setDemands] = useState<DemandRequest[]>([]);
  const [activeDemand, setActiveDemand] = useState<DemandRequest | null>(null);
  const [matches, setMatches] = useState<DisplayMatch[]>([]);
  const [sortBy, setSortBy] = useState<'best' | 'price' | 'quantity'>('best');

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const allDemands = session?.role === 'buyer'
          ? await demandService.fetchMine()
          : await demandService.fetchAll();

        if (!isMounted) return;
        setDemands(allDemands);

        let selectedDemand: DemandRequest | null = null;
        if (demandId) {
          selectedDemand = allDemands.find((d) => d.id === demandId) || await demandService.fetchById(demandId);
        } else if (allDemands.length > 0) {
          selectedDemand = allDemands.find((d) => d.status === 'open' || d.status === 'matched') || allDemands[0];
        }

        if (isMounted) {
          setActiveDemand(selectedDemand);
        }

        // Fetch all active listings
        const allListings = (await supplyService.fetchAll()).filter((l) => l.status === 'active');

        if (selectedDemand) {
          // Compute matches for this demand
          const computedMatches = await matchingService.findMatchesForDemand(selectedDemand);
          const matchMap = new Map<string, Match>();
          computedMatches.forEach((m) => matchMap.set(m.listingId, m));

          // Filter listings matching this commodity
          const relevantListings = allListings.filter((l) => l.commodity === selectedDemand!.commodity);

          const displayMatches: DisplayMatch[] = (relevantListings.length > 0 ? relevantListings : allListings).map((l) => {
            const m = matchMap.get(l.id) || null;
            return {
              listing: l,
              match: m,
              score: m ? m.score : (l.commodity === selectedDemand!.commodity ? 50 : 20),
            };
          });

          if (isMounted) {
            setMatches(displayMatches);
          }
        } else {
          // If no demand selected, show all active listings
          if (isMounted) {
            setMatches(
              allListings.map((l) => ({
                listing: l,
                match: null,
                score: 100,
              }))
            );
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load matches:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [demandId, session]);

  const handleSelectDemand = (d: DemandRequest) => {
    navigate(`/app/matches/${d.id}`);
  };

  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === 'price') return a.listing.pricePerUnit - b.listing.pricePerUnit;
    if (sortBy === 'quantity') return b.listing.quantity - a.listing.quantity;
    return b.score - a.score;
  });

  const handleSelectListing = (item: DisplayMatch) => {
    toast('success', `Selected ${item.listing.supplierName}. Proceeding to review transaction.`);
    const demandQuery = activeDemand ? `?demandId=${activeDemand.id}` : '';
    navigate(`/app/transactions/review/${item.listing.id}${demandQuery}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/app/demands" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Match Results</h1>
            <span className="status-pill status-pill-green">LIVE MATCHES</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {activeDemand
              ? `Demand ${activeDemand.id} · ${formatCommodity(activeDemand.commodity)} · ${activeDemand.quantity} ${activeDemand.unit} · Deliver to ${activeDemand.destinationLocation}`
              : 'Browse compatible suppliers for your procurement requirements.'}
          </p>
        </div>

        {demands.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Switch Demand:</label>
            <select
              value={activeDemand?.id || ''}
              onChange={(e) => {
                const sel = demands.find((d) => d.id === e.target.value);
                if (sel) handleSelectDemand(sel);
              }}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-800"
            >
              {demands.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} - {formatCommodity(d.commodity)} ({d.quantity} {d.unit})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filter and Sort Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs font-semibold text-gray-800">
          {matches.length} {matches.length === 1 ? 'supplier' : 'suppliers'} available
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 font-medium mr-1">Sort:</span>
          <button
            type="button"
            onClick={() => setSortBy('best')}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              sortBy === 'best'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Best match
          </button>
          <button
            type="button"
            onClick={() => setSortBy('price')}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              sortBy === 'price'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Price
          </button>
          <button
            type="button"
            onClick={() => setSortBy('quantity')}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              sortBy === 'quantity'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Quantity
          </button>
        </div>
      </div>

      {/* Supplier Match Cards List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Finding matching suppliers…
        </div>
      ) : sortedMatches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-xs">
          <div className="text-3xl mb-3">🌾</div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">No supplier listings found yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
            Suppliers listing {activeDemand ? formatCommodity(activeDemand.commodity) : 'produce'} will appear here automatically when posted.
          </p>
          <Link
            to="/app/supply"
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMatches.map((item) => {
            const { listing, match, score } = item;
            const isTopMatch = score >= 70;

            return (
              <div
                key={listing.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition-all"
              >
                {/* Supplier Details */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-2xl shrink-0">
                    {COMMODITY_ICONS[listing.commodity] ?? '🌾'}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900">{listing.supplierName}</h3>
                      <VerifiedBadge verified={listing.supplierVerified} />
                      {isTopMatch && (
                        <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">
                          {score}% MATCH
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {listing.location} · {formatCommodity(listing.commodity)} · Grade {listing.qualityGrade}
                    </div>
                    {match?.factors && match.factors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {match.factors
                          .filter((f) => f.matched)
                          .map((f) => (
                            <span key={f.label} className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              {f.label}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price & Action */}
                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-right">
                    <div className="text-base font-bold text-gray-900">
                      {formatCurrency(listing.pricePerUnit, listing.currency)}{' '}
                      <span className="text-xs font-normal text-gray-500">/ {listing.unit}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {listing.quantity} {listing.unit} available
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/supply/${listing.id}`)}
                      className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors cursor-pointer"
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectListing(item)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      Select
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
