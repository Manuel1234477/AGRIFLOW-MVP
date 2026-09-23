import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, CheckCircle2, Building2 } from 'lucide-react';
import { demandService } from '../services/demandService';
import { matchingService } from '../services/matchingService';
import { supplyService } from '../services/supplyService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';
import { formatCurrency, formatDate, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import type { DemandRequest, Match } from '../types';

export function DemandsPage() {
  const { session } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [matching, setMatching] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<{ demandId: string; matches: Match[] } | null>(null);
  const [demands, setDemands] = useState<DemandRequest[]>([]);
  const [_loading, setLoading] = useState(true);

  const isBuyer = session?.role === 'buyer';

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const live = isBuyer
          ? await demandService.fetchMine()
          : await demandService.fetchAll();
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
      else toast('success', `${matches.length} compatible listing(s) found.`);
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Failed to match demand');
    } finally {
      setMatching(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isBuyer ? 'My Demand Requests' : 'Market Demand Requests (Buyer Orders)'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isBuyer
              ? 'Create and manage your procurement demands.'
              : 'Browse active commodity demands posted by verified buyers across Nigeria.'}
          </p>
        </div>
        {isBuyer && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/app/demands/new')}>
            Create Demand
          </Button>
        )}
      </div>

      {demands.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-7 h-7" />}
          title="No demand requests yet"
          description={
            isBuyer
              ? 'Create a demand to start discovering matching agricultural supply.'
              : 'No open buyer demands currently posted.'
          }
          action={
            isBuyer ? (
              <Button onClick={() => navigate('/app/demands/new')} icon={<Plus className="w-4 h-4" />}>
                Create Demand
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {demands.map((d) => (
            <Card key={d.id}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{COMMODITY_ICONS[d.commodity] ?? '🌾'}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-gray-900">{formatCommodity(d.commodity)}</h3>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                            d.status === 'matched'
                              ? 'bg-agri-50 border-agri-200 text-agri-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono text-gray-400">{d.id}</span>
                        {!isBuyer && (
                          <span className="flex items-center gap-1 font-medium text-gray-700">
                            <Building2 className="w-3 h-3 text-gray-400" />
                            {d.buyerName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={matching === d.id}
                    icon={<Search className="w-3.5 h-3.5" />}
                    onClick={() => runMatch(d)}
                  >
                    Find Matches
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Quantity</div>
                    <div className="font-medium text-gray-800">{d.quantity} {d.unit}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Grade</div>
                    <div className="font-medium text-gray-800">Grade {d.qualityGrade}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Destination</div>
                    <div className="font-medium text-gray-800">{d.destinationLocation}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Required by</div>
                    <div className="font-medium text-gray-800">{formatDate(d.requiredByDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Indicative Budget</div>
                    <div className="font-semibold text-agri-700">{formatCurrency(d.indicativeBudget)}</div>
                  </div>
                </div>

                {/* Match results for this demand */}
                {matchResults?.demandId === d.id && matchResults.matches.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-600 mb-2">
                      {matchResults.matches.length} Compatible Listing{matchResults.matches.length > 1 ? 's' : ''}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {matchResults.matches.map((m) => {
                        const listing = supplyService.getById(m.listingId);
                        if (!listing) return null;
                        return (
                          <div
                            key={m.id}
                            onClick={() => navigate(`/app/supply/${m.listingId}`)}
                            className="px-3 py-2.5 bg-agri-50 border border-agri-200 rounded-lg cursor-pointer hover:bg-agri-100 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-sm font-semibold text-agri-800">{listing.supplierName}</div>
                              <div className="text-sm font-bold text-agri-600">{m.score}%</div>
                            </div>
                            <div className="text-xs text-agri-600">
                              {listing.quantity} {listing.unit} · {formatCurrency(listing.pricePerUnit)}/{listing.unit}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {m.factors
                                .filter((f) => f.matched)
                                .map((f) => (
                                  <span
                                    key={f.label}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-agri-700"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
