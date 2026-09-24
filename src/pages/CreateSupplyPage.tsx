import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { supplyService } from '../services/supplyService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Loader2 } from 'lucide-react';
import { MediaUploader } from '../components/ui/MediaUploader';
import type { CommodityType, QualityGrade, ListingMedia, InspectionDetails } from '../types';

export function CreateSupplyPage() {
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mediaList, setMediaList] = useState<ListingMedia[]>([]);

  const [form, setForm] = useState({
    commodity: 'maize' as CommodityType,
    quantity: '',
    unit: 'tonnes',
    qualityGrade: 'A' as QualityGrade,
    pricePerUnit: '',
    location: 'Kaduna Central Silos, Kaduna State',
    availabilityDate: '',
    description: '',
    moistureContent: '12.5%',
    packagingType: '50kg Polypropylene Bags',
    storageType: 'Ventilated Silo / Warehouse',
    batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!form.quantity || !form.pricePerUnit || !form.location || !form.availabilityDate) {
      toast('error', 'Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      const photos = mediaList.filter((m) => m.type === 'image').map((m) => m.url);
      const videos = mediaList.filter((m) => m.type === 'video').map((m) => m.url);

      const inspectionDetails: InspectionDetails = {
        moistureContent: form.moistureContent,
        packagingType: form.packagingType,
        storageType: form.storageType,
        batchNumber: form.batchNumber,
        harvestDate: new Date(form.availabilityDate).toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
        }),
        certifications: ['Verified Visual Inspection', 'Escrow Quality Guaranteed'],
      };

      const l = await supplyService.create({
        supplierId: session.userId,
        supplierName: session.name,
        supplierVerified: true,
        commodity: form.commodity,
        quantity: Number(form.quantity),
        unit: form.unit,
        qualityGrade: form.qualityGrade,
        pricePerUnit: Number(form.pricePerUnit),
        currency: 'NGN',
        location: form.location,
        availabilityDate: new Date(form.availabilityDate).toISOString(),
        description: form.description,
        photos,
        videos,
        media: mediaList,
        inspectionDetails,
      });

      toast('success', `Listing ${l.id} published with verified media.`);
      navigate('/app/supply/manage');
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Supply Listing</h1>
          <p className="text-sm text-gray-500">
            Publish your available agricultural supply with photos, videos, and specifications.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Commodity & Grade */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                1. Commodity Specifications
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Commodity <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={form.commodity}
                    onChange={(e) => set('commodity', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  >
                    <option value="maize">Yellow Maize</option>
                    <option value="rice">Rice (Parboiled / Local)</option>
                    <option value="soybean">Soybean</option>
                    <option value="sorghum">White Sorghum</option>
                    <option value="beans">Beans (Oloyin / Drum)</option>
                    <option value="yam">Yam Tubers</option>
                    <option value="wheat">Wheat</option>
                    <option value="cassava">Cassava (Tubers / Chips)</option>
                    <option value="millet">Pearl Millet</option>
                    <option value="groundnut">Groundnut (Peanuts)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quality Grade <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={form.qualityGrade}
                    onChange={(e) => set('qualityGrade', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  >
                    <option value="A">Grade A (Premium Export Quality)</option>
                    <option value="B">Grade B (Standard Commercial Grade)</option>
                    <option value="C">Grade C (Industrial / Feed Processing)</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Available Quantity <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit of Measurement</label>
                  <select
                    value={form.unit}
                    onChange={(e) => set('unit', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  >
                    <option value="tonnes">Tonnes (Metric Tonnes MT)</option>
                    <option value="bags (50kg)">Bags (50kg Standard)</option>
                    <option value="bags (100kg)">Bags (100kg Jumbo)</option>
                    <option value="bags (25kg)">Bags (25kg)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="crates">Crates</option>
                    <option value="baskets">Baskets</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price per Unit (₦) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.pricePerUnit}
                    onChange={(e) => set('pricePerUnit', e.target.value)}
                    placeholder="e.g. 850000"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Price in Nigerian Naira (NGN)</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Farm / Warehouse Location <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.location}
                    onChange={(e) => set('location', e.target.value)}
                    placeholder="e.g. Kaduna Central Silos, Kaduna State"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Availability Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={form.availabilityDate}
                  onChange={(e) => set('availabilityDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">When produce is ready for physical pickup/inspection</p>
              </div>
            </div>

            {/* 2. Media Uploads: Images and Videos */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                2. Visual Proof &amp; Media Uploads
              </h2>
              <MediaUploader
                commodity={form.commodity}
                media={mediaList}
                onChange={setMediaList}
              />
            </div>

            {/* 3. Detailed Inspection Sheet */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                3. Technical Inspection &amp; Quality Metrics
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Moisture Content (%)</label>
                  <input
                    type="text"
                    value={form.moistureContent}
                    onChange={(e) => set('moistureContent', e.target.value)}
                    placeholder="e.g. 12.5%"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Packaging Type</label>
                  <input
                    type="text"
                    value={form.packagingType}
                    onChange={(e) => set('packagingType', e.target.value)}
                    placeholder="e.g. 50kg Polypropylene Air-sealed Bags"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Storage Type</label>
                  <input
                    type="text"
                    value={form.storageType}
                    onChange={(e) => set('storageType', e.target.value)}
                    placeholder="e.g. Temperature Controlled Silo"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Batch / Lot Number</label>
                  <input
                    type="text"
                    value={form.batchNumber}
                    onChange={(e) => set('batchNumber', e.target.value)}
                    placeholder="e.g. BATCH-849201"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">General Description &amp; Notes for Buyers</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Disclose certifications, processing method, foreign matter percentage, sorting level, and pickup access instructions..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Publish Listing with Media
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}

