import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Power } from 'lucide-react';
import { supplyService } from '../services/supplyService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';
import { VerifiedBadge } from '../components/ui/VerifiedBadge';
import { formatCurrency, formatDate, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import type { SupplyListing } from '../types';

export function SupplyManagePage() {
  const { session } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [toggling, setToggling] = useState<string | null>(null);
  const [listings, setListings] = useState<SupplyListing[]>([]);
  const [_loading, setLoading] = useState(true);

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
      window.location.reload();
    } catch (e: any) { toast('error', e.message); }
    finally { setToggling(null); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Supply Listings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your published agricultural supply.</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/app/supply/new')}>
          New Listing
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          icon={<Package className="w-7 h-7" />}
          title="No supply listings"
          description="Create your first supply listing to start receiving transaction requests from buyers."
          action={<Button onClick={() => navigate('/app/supply/new')} icon={<Plus className="w-4 h-4" />}>Create Listing</Button>}
        />
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <Card key={l.id}>
              <div className="p-5 flex items-start gap-4">
                <div className="text-4xl">{COMMODITY_ICONS[l.commodity] ?? '🌾'}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-gray-900">{formatCommodity(l.commodity)}</h3>
                        <VerifiedBadge verified={l.supplierVerified} />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border
                          ${l.status === 'active' ? 'bg-agri-50 border-agri-200 text-agri-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {l.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-gray-400 mb-2">{l.id}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm" variant="ghost"
                        loading={toggling === l.id}
                        icon={<Power className="w-3.5 h-3.5" />}
                        onClick={() => toggleStatus(l.id, l.status)}
                      >
                        {l.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><div className="text-xs text-gray-500 mb-0.5">Quantity</div><div className="font-medium">{l.quantity} {l.unit}</div></div>
                    <div><div className="text-xs text-gray-500 mb-0.5">Grade</div><div className="font-medium">Grade {l.qualityGrade}</div></div>
                    <div><div className="text-xs text-gray-500 mb-0.5">Price</div><div className="font-semibold text-agri-700">{formatCurrency(l.pricePerUnit)}/{l.unit}</div></div>
                    <div><div className="text-xs text-gray-500 mb-0.5">Available</div><div className="font-medium">{formatDate(l.availabilityDate)}</div></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{l.location}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
