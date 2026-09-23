import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { demandService } from '../services/demandService';
import { useToast } from '../components/ui/Toast';
import type { CommodityType, QualityGrade } from '../types';

export function CreateDemandPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [commodity, setCommodity] = useState<CommodityType>('maize');
  const [grade, setGrade] = useState<QualityGrade>('A');
  const [quantity, setQuantity] = useState('12');
  const [unit, setUnit] = useState('tonnes');
  const [location, setLocation] = useState('Ikeja, Lagos');
  const [neededBy, setNeededBy] = useState('2026-09-08');
  const [budgetMin, setBudgetMin] = useState('450000');
  const [budgetMax, setBudgetMax] = useState('500000');
  const [notes, setNotes] = useState('Packaging in 50kg sacks. Standard moisture under 12%.');
  const [loading, setLoading] = useState(false);

  const { session } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commodity || !quantity || !location) {
      toast('error', 'Please fill in required fields.');
      return;
    }
    setStep(2);
  };

  const handleSubmitDemand = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const budgetAvg = budgetMax ? Number(budgetMax) * Number(quantity) : 0;
      await demandService.create({
        buyerId: session.userId,
        buyerName: session.name,
        commodity,
        quantity: Number(quantity),
        unit,
        qualityGrade: grade,
        destinationLocation: location,
        requiredByDate: new Date(neededBy || Date.now() + 86400000 * 10).toISOString(),
        indicativeBudget: budgetAvg,
        currency: 'NGN',
        notes,
      });

      toast('success', 'Demand submitted successfully! Find matching supply from your demands list.');
      setStep(3);
      setTimeout(() => {
        // /app/matches/:id is a static demo page with hardcoded fake IDs,
        // not wired to real data — /app/demands has a working "Find
        // Matches" action against this real demand instead.
        navigate('/app/demands');
      }, 1200);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to submit demand.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/app/demands"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          ← Back to My Demands
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create demand</h1>
        <p className="text-xs text-gray-500 mt-1">
          Describe what you want to buy. AgriFlow matches this against available supply.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`px-3 py-1 rounded-full font-medium ${
            step === 1 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          1 Requirements
        </span>
        <span className="text-gray-400">—</span>
        <span
          className={`px-3 py-1 rounded-full font-medium ${
            step === 2 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          2 Review
        </span>
        <span className="text-gray-400">—</span>
        <span
          className={`px-3 py-1 rounded-full font-medium ${
            step === 3 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          3 Submitted
        </span>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">
              Requirements
            </h2>

            <form onSubmit={handleReview} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Commodity
                  </label>
                  <select
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value as CommodityType)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  >
                    <option value="maize">White Maize</option>
                    <option value="soybean">Soybean</option>
                    <option value="sorghum">Sorghum</option>
                    <option value="rice">Rice</option>
                    <option value="beans">Beans</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Grade / quality
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as QualityGrade)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  >
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none bg-white text-gray-900 cursor-pointer"
                  >
                    <option value="tonnes">Tonnes (MT)</option>
                    <option value="bags (50kg)">Bags (50kg)</option>
                    <option value="bags (100kg)">Bags (100kg)</option>
                    <option value="bags (25kg)">Bags (25kg)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="crates">Crates</option>
                    <option value="baskets">Baskets</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Delivery location
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Address or LGA (e.g. Ikeja, Lagos)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Needed by
                </label>
                <input
                  type="date"
                  required
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Budget range per tonne (optional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="Minimum (₦)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  />
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="Maximum (₦)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Additional notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Packaging, handling or timing requirements…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => navigate('/app/demands')}
                  className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                >
                  Save as draft
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-black rounded-lg transition-colors shadow-xs"
                >
                  Review demand
                </button>
              </div>
            </form>
          </div>

          {/* How matching works sidebar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h3 className="text-xs font-semibold text-gray-900 mb-2">How matching works</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Once submitted, AgriFlow compares your demand against active supply listings and
              returns suitable suppliers. You choose who to transact with — matches are never
              auto-assigned.
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs max-w-2xl space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">
            Review Demand Details
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-500 font-medium">Commodity</div>
              <div className="text-gray-900 font-semibold mt-0.5 capitalize">{commodity} (Grade {grade})</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Quantity</div>
              <div className="text-gray-900 font-semibold mt-0.5">{quantity} {unit}</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Delivery Destination</div>
              <div className="text-gray-900 font-semibold mt-0.5">{location}</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Required Date</div>
              <div className="text-gray-900 font-semibold mt-0.5">{neededBy}</div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-500 font-medium">Target Price Range</div>
              <div className="text-gray-900 font-semibold mt-0.5">₦{Number(budgetMin).toLocaleString()} – ₦{Number(budgetMax).toLocaleString()} / {unit}</div>
            </div>
            {notes && (
              <div className="col-span-2">
                <div className="text-gray-500 font-medium">Notes</div>
                <div className="text-gray-700 mt-0.5 bg-gray-50 p-2.5 rounded-md border border-gray-100">{notes}</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
            >
              Edit Requirements
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmitDemand}
              className="px-5 py-2 text-xs font-medium text-white bg-agri-700 hover:bg-agri-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              {loading ? 'Submitting & Matching...' : 'Submit & Find Matches'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-xs max-w-xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto text-lg font-bold">
            ✓
          </div>
          <h2 className="text-lg font-bold text-gray-900">Demand Submitted</h2>
          <p className="text-xs text-gray-500">
            AgriFlow has matched your demand against verified suppliers. Redirecting to matches...
          </p>
        </div>
      )}
    </div>
  );
}
