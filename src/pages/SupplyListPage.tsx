import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar } from 'lucide-react';
import { supplyService } from '../services/supplyService';
import { VerifiedBadge } from '../components/ui/VerifiedBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate, formatCommodity, COMMODITY_ICONS } from '../utils/format';
import type { CommodityType, SupplyListing } from '../types';

export function SupplyListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterCommodity, setFilterCommodity] = useState('');
  const [filterVerified, setFilterVerified] = useState('');
  const [allListings, setAllListings] = useState<SupplyListing[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const live = await supplyService.fetchAll();
        if (isMounted) setAllListings(live);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const all = allListings.filter((l) => l.status === 'active');
  const filtered = all.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.commodity.includes(q) || l.supplierName.toLowerCase().includes(q) || l.location.toLowerCase().includes(q);
    const matchCommodity = !filterCommodity || l.commodity === filterCommodity;
    const matchVerified = filterVerified === '' || String(l.supplierVerified) === filterVerified;
    return matchSearch && matchCommodity && matchVerified;
  });

  const commodities: { value: CommodityType; label: string }[] = [
    { value: 'maize', label: 'Maize' }, { value: 'rice', label: 'Rice' },
    { value: 'soybean', label: 'Soybean' }, { value: 'sorghum', label: 'Sorghum' },
    { value: 'beans', label: 'Beans' }, { value: 'yam', label: 'Yam' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Supply Discovery</h1>
        <p className="text-sm text-gray-500 mt-0.5">Browse available agricultural supply from verified and unverified suppliers.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commodity, supplier, location..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
            />
          </div>
        </div>
        <select
          value={filterCommodity}
          onChange={(e) => setFilterCommodity(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">All commodities</option>
          {commodities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={filterVerified}
          onChange={(e) => setFilterVerified(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">All suppliers</option>
          <option value="true">Verified only</option>
          <option value="false">Unverified</option>
        </select>
      </div>

      <div className="text-xs text-gray-500 mb-4">{filtered.length} listing{filtered.length !== 1 ? 's' : ''} found</div>

      {filtered.length === 0 ? (
        <EmptyState title="No supply listings found" description="Try adjusting your filters or check back later." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing) => (
            <div key={listing.id} className="bg-white rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 cursor-pointer transition-all" onClick={() => navigate(`/app/supply/${listing.id}`)}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{COMMODITY_ICONS[listing.commodity] ?? '🌾'}</div>
                  <VerifiedBadge verified={listing.supplierVerified} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-0.5">{formatCommodity(listing.commodity)}</h3>
                <div className="text-xs text-gray-500 mb-3">Grade {listing.qualityGrade} · {listing.id}</div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Quantity</span>
                    <span className="font-medium text-gray-800">{listing.quantity} {listing.unit}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Price</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(listing.pricePerUnit)}/{listing.unit}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {listing.location}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    Available {formatDate(listing.availabilityDate)}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-600 font-medium">{listing.supplierName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Total value: {formatCurrency(listing.quantity * listing.pricePerUnit)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
