import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, CheckCircle2 } from 'lucide-react';
import { demandService } from '../services/demandService';
import { matchingService } from '../services/matchingService';
import { supplyService } from '../services/supplyService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { formatCurrency, formatDate, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import type { DemandRequest, Match } from '../types';

type DFilter = 'all' | 'open' | 'matched' | 'closed';

export function DemandsPage() {
  const { session } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [matching, setMatching] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<{ demandId: string; matches: Match[] } | null>(null);
  const [demands, setDemands] = useState<DemandRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DFilter>('all');

  const isBuyer = session?.role === 'buyer';

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const live = isBuyer ? await demandService.fetchMine() : await demandService.fetchAll();
        if (isMounted) setDemands(live);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [session, isBuyer]);

  if (!session) return null;

  const runMatch = async (demand: DemandRequest) => {
    setMatching(demand.id);
    try {
      const matches = await matchingService.findMatchesForDemand(demand);
      setMatchResults({ demandId: demand.id, matches });
      if (matches.length === 0) toast('info', 'No strong matches found for this demand.');
      else {
        toast('success', `${matches.length} compatible listing(s) found.`);
        navigate(`/app/matches/${demand.id}`);
      }
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Failed to match demand');
    } finally {
      setMatching(null);
    }
  };

  const openCount = demands.filter(d => d.status === 'open').length;
  const matchedCount = demands.filter(d => d.status === 'matched' || d.status === 'fulfilled').length;
  const closedCount = demands.filter(d => d.status === 'closed').length;

  const filtered = demands.filter(d => {
    if (filter === 'all') return true;
    if (filter === 'open') return d.status === 'open';
    if (filter === 'matched') return d.status === 'matched' || d.status === 'fulfilled';
    if (filter === 'closed') return d.status === 'closed';
    return true;
  });

  const tabs: { key: DFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: demands.length },
    { key: 'open', label: 'Open', count: openCount },
    { key: 'matched', label: 'Matched', count: matchedCount },
    { key: 'closed', label: 'Closed', count: closedCount },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {isBuyer ? 'My Demands' : 'Market Demands'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isBuyer
              ? 'Track your procurement requests and discover matching supply.'
              : 'Browse active commodity demands posted by verified buyers.'}
          </p>
        </div>
        {isBuyer && (
          <button
            onClick={() => navigate('/app/demands/new')}
            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-xs"
          >
            <Plus size={15} />
            Create Demand
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                filter === tab.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  filter === tab.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Demand List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading demands…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-3xl mb-3">📋</div>
          <div className="text-sm font-semibold text-gray-700 mb-1">
            {filter === 'all' ? 'No demand requests yet' : `No ${filter} demands`}
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {isBuyer && filter === 'all'
              ? 'Create a demand to start discovering matching agricultural supply.'
              : 'Nothing here yet.'}
          </p>
          {isBuyer && filter === 'all' && (
            <button
              onClick={() => navigate('/app/demands/new')}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <Plus size={15} />
              Create Demand
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-all">
              <div className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-xl shrink-0">
                      {COMMODITY_ICONS[d.commodity] ?? '🌾'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">{formatCommodity(d.commodity)}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border uppercase tracking-wide ${
                          d.status === 'matched' || d.status === 'fulfilled'
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : d.status === 'closed'
                            ? 'bg-gray-50 border-gray-200 text-gray-500'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {d.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">{d.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isBuyer && (
                      <button
                        type="button"
                        disabled={matching === d.id}
                        onClick={() => runMatch(d)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
                      >
                        {matching === d.id ? (
                          <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
                        ) : (
                          <Search size={12} />
                        )}
                        {matching === d.id ? 'Searching…' : 'Find Matches'}
                      </button>
                    )}
                    <Link
                      to={`/app/matches/${d.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
                    >
                      View Matches
                    </Link>

                  </div>
                </div>

                {/* Specs grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <div className="text-gray-400 mb-0.5">Quantity</div>
                    <div className="font-semibold text-gray-800">{d.quantity} {d.unit}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Grade</div>
                    <div className="font-semibold text-gray-800">Grade {d.qualityGrade}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Destination</div>
                    <div className="font-semibold text-gray-800 truncate">{d.destinationLocation}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Required by</div>
                    <div className="font-semibold text-gray-800">{formatDate(d.requiredByDate)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Budget</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(d.indicativeBudget)}</div>
                  </div>
                </div>

                {/* Match results inline */}
                {matchResults?.demandId === d.id && matchResults.matches.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      {matchResults.matches.length} Compatible Listing{matchResults.matches.length > 1 ? 's' : ''} found
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {matchResults.matches.map((m) => {
                        const listing = supplyService.getById(m.listingId);
                        if (!listing) return null;
                        return (
                          <div
                            key={m.id}
                            onClick={() => navigate(`/app/supply/${m.listingId}`)}
                            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-semibold text-gray-900">{listing.supplierName}</div>
                              <div className="text-xs font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">{m.score}%</div>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {listing.quantity} {listing.unit} · {formatCurrency(listing.pricePerUnit)}/{listing.unit}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {m.factors.filter(f => f.matched).map(f => (
                                <span key={f.label} className="inline-flex items-center gap-0.5 text-[10px] text-green-700">
                                  <CheckCircle2 size={10} />
                                  {f.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
