import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Power, Images, ChevronDown } from 'lucide-react';
import { supplyService } from '../services/supplyService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { MediaUploader } from '../components/ui/MediaUploader';
import { formatCurrency, formatDate, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import type { SupplyListing, ListingMedia } from '../types';

export function SupplyManagePage() {
  const { session } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [toggling, setToggling] = useState<string | null>(null);
  const [listings, setListings] = useState<SupplyListing[]>([]);
  const [_loading, setLoading] = useState(true);
  // Listing whose photos & videos panel is open (one at a time).
  const [mediaOpen, setMediaOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const live = await supplyService.fetchMine();
        if (isMounted) setListings(live);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [session]);

  if (!session) return null;

  const toggleStatus = async (listingId: string, current: string) => {
    setToggling(listingId);
    try {
      const newStatus = current === 'active' ? 'inactive' : 'active';
      await supplyService.setStatus(listingId, session.userId, newStatus as any);
      toast('success', `Listing ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status: newStatus as any } : l)));
    } catch (e: any) { toast('error', e.message); }
    finally { setToggling(null); }
  };

  // Uploads, removals and cover changes are saved by MediaUploader as they
  // happen; this only keeps the card's list in step.
  const setListingMedia = (listingId: string, media: ListingMedia[]) =>
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, media } : l)));


  const active = listings.filter(l => l.status === 'active').length;
  const inactive = listings.filter(l => l.status !== 'active').length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Supply</h1>
          <p className="text-xs text-gray-500 mt-1">
            {active} active listing{active !== 1 ? 's' : ''}{inactive > 0 ? ` · ${inactive} inactive` : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/supply/new')}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-xs"
        >
          <Plus size={15} />
          New Listing
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="py-16 text-center">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm font-semibold text-gray-700 mb-1">No supply listings</div>
          <p className="text-xs text-gray-500 mb-4">Create your first listing to start receiving buyer requests.</p>
          <button
            onClick={() => navigate('/app/supply/new')}
            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={15} />
            Create Listing
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <div key={l.id} className="bg-white rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-all">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-xl shrink-0">
                      {COMMODITY_ICONS[l.commodity] ?? '🌾'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">{formatCommodity(l.commodity)}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${
                          l.status === 'active'
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}>
                          {l.status}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5">{l.id}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={toggling === l.id}
                    onClick={() => toggleStatus(l.id, l.status)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Power size={12} />
                    {toggling === l.id ? 'Updating…' : l.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-gray-400 mb-0.5">Quantity</div>
                    <div className="font-semibold text-gray-800">{l.quantity} {l.unit}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Grade</div>
                    <div className="font-semibold text-gray-800">Grade {l.qualityGrade}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Price per unit</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(l.pricePerUnit)}/{l.unit}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Available from</div>
                    <div className="font-semibold text-gray-800">{formatDate(l.availabilityDate)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 mt-2.5">
                  <div className="text-xs text-gray-400">{l.location}</div>
                  <button
                    type="button"
                    onClick={() => setMediaOpen(mediaOpen === l.id ? null : l.id)}
                    aria-expanded={mediaOpen === l.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0"
                  >
                    <Images size={12} />
                    Photos &amp; videos ({l.media?.length ?? 0})
                    <ChevronDown size={12} className={`transition-transform ${mediaOpen === l.id ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {mediaOpen === l.id && (
                <div className="border-t border-gray-100 p-5">
                  <MediaUploader
                    listingId={l.id}
                    media={l.media ?? []}
                    onChange={(media) => setListingMedia(l.id, media)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
