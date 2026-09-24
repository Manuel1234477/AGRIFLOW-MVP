import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';

interface SupplierMatch {
  id: string;
  name: string;
  isBestMatch?: boolean;
  location: string;
  distance: string;
  distanceKm: number;
  grade: string;
  verified: boolean;
  isNew?: boolean;
  pricePerTonne: number;
  availableTonnes: number;
}

export function MatchResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState<'best' | 'distance' | 'price' | 'quantity'>('best');

  const matches: SupplierMatch[] = [
    {
      id: 'SUP-337',
      name: 'Adeyemi Produce Co.',
      isBestMatch: true,
      location: 'Oyo State',
      distance: '142 km away',
      distanceKm: 142,
      grade: 'Grade A',
      verified: true,
      pricePerTonne: 480000,
      availableTonnes: 18,
    },
    {
      id: 'SUP-338',
      name: 'Green Delta Farms',
      location: 'Kwara State',
      distance: '210 km away',
      distanceKm: 210,
      grade: 'Grade A',
      verified: true,
      pricePerTonne: 465000,
      availableTonnes: 12,
    },
    {
      id: 'SUP-339',
      name: 'Kaduna Grain Union',
      location: 'Kaduna State',
      distance: '640 km away',
      distanceKm: 640,
      grade: 'Grade B',
      verified: true,
      pricePerTonne: 441000,
      availableTonnes: 40,
    },
    {
      id: 'SUP-340',
      name: 'Ilorin Agro Traders',
      location: 'Kwara State',
      distance: '198 km away',
      distanceKm: 198,
      grade: 'Grade A',
      verified: false,
      isNew: true,
      pricePerTonne: 502000,
      availableTonnes: 12,
    },
  ];

  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === 'price') return a.pricePerTonne - b.pricePerTonne;
    if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
    if (sortBy === 'quantity') return b.availableTonnes - a.availableTonnes;
    return (b.isBestMatch ? 1 : 0) - (a.isBestMatch ? 1 : 0);
  });

  const handleSelectSupplier = (supplier: SupplierMatch) => {
    toast('success', `Selected ${supplier.name}. Proceeding to review transaction.`);
    navigate(`/app/transactions/review/${supplier.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Match results</h1>
            <span className="status-pill status-pill-gray">MATCHED</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Demand {id || 'D-1043'} · White Maize · 12 tonnes · Deliver to Ikeja, Lagos
          </p>
        </div>
      </div>

      {/* Filter and Sort Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs font-semibold text-gray-800">
          {matches.length} suppliers matched
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 font-medium mr-1">Sort:</span>
          <button
            type="button"
            onClick={() => setSortBy('best')}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
              sortBy === 'best'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Best match
          </button>
          <button
            type="button"
            onClick={() => setSortBy('distance')}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
              sortBy === 'distance'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Distance
          </button>
          <button
            type="button"
            onClick={() => setSortBy('price')}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
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
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
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
      <div className="space-y-3">
        {sortedMatches.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition-all"
          >
            {/* Supplier Details */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-700 shrink-0">
                {supplier.name.charAt(0)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{supplier.name}</h3>
                  {supplier.isBestMatch && (
                    <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">
                      BEST MATCH
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {supplier.location} · {supplier.distance}
                </div>
                <div className="text-xs text-gray-500">
                  {supplier.grade} · {supplier.verified ? 'Verified supplier' : 'New supplier'}
                </div>
              </div>
            </div>

            {/* Price & Action */}
            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
              <div className="text-right">
                <div className="text-base font-bold text-gray-900">
                  ₦{supplier.pricePerTonne.toLocaleString()} <span className="text-xs font-normal text-gray-500">/ tonne</span>
                </div>
                <div className="text-xs text-gray-500">
                  {supplier.availableTonnes}t available
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toast('info', `${supplier.name} has 34 completed transactions and 98% on-time delivery rate.`)}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                >
                  View supplier
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSupplier(supplier)}
                  className="px-4 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs"
                >
                  Select
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
