import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { supplyService } from '../services/supplyService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
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

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Commodity & Grade */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                1. Commodity Specifications
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Select
                  label="Commodity"
                  value={form.commodity}
                  onChange={(e) => set('commodity', e.target.value)}
                  required
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
                </Select>
                <Select
                  label="Quality Grade"
                  value={form.qualityGrade}
                  onChange={(e) => set('qualityGrade', e.target.value)}
                  required
                >
                  <option value="A">Grade A (Premium Export Quality)</option>
                  <option value="B">Grade B (Standard Commercial Grade)</option>
                  <option value="C">Grade C (Industrial / Feed Processing)</option>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Available Quantity"
                  type="number"
                  required
                  min="1"
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                  placeholder="e.g. 50"
                />
                <Select label="Unit of Measurement" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                  <option value="tonnes">Tonnes (Metric Tonnes MT)</option>
                  <option value="bags (50kg)">Bags (50kg Standard)</option>
                  <option value="bags (100kg)">Bags (100kg Jumbo)</option>
                  <option value="bags (25kg)">Bags (25kg)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="crates">Crates</option>
                  <option value="baskets">Baskets</option>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Price per Unit (₦)"
                  type="number"
                  required
                  min="1"
                  value={form.pricePerUnit}
                  onChange={(e) => set('pricePerUnit', e.target.value)}
                  placeholder="e.g. 850000"
                  hint="Price in Nigerian Naira (NGN)"
                />
                <Input
                  label="Farm / Warehouse Location"
                  required
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. Kaduna Central Silos, Kaduna State"
                />
              </div>

              <Input
                label="Availability Date"
                type="date"
                required
                value={form.availabilityDate}
                onChange={(e) => set('availabilityDate', e.target.value)}
                hint="When produce is ready for physical pickup/inspection"
              />
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
                <Input
                  label="Moisture Content (%)"
                  value={form.moistureContent}
                  onChange={(e) => set('moistureContent', e.target.value)}
                  placeholder="e.g. 12.5%"
                />
                <Input
                  label="Packaging Type"
                  value={form.packagingType}
                  onChange={(e) => set('packagingType', e.target.value)}
                  placeholder="e.g. 50kg Polypropylene Air-sealed Bags"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Storage Type"
                  value={form.storageType}
                  onChange={(e) => set('storageType', e.target.value)}
                  placeholder="e.g. Temperature Controlled Silo"
                />
                <Input
                  label="Batch / Lot Number"
                  value={form.batchNumber}
                  onChange={(e) => set('batchNumber', e.target.value)}
                  placeholder="e.g. BATCH-849201"
                />
              </div>

              <Textarea
                label="General Description &amp; Notes for Buyers"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={4}
                placeholder="Disclose certifications, processing method, foreign matter percentage, sorting level, and pickup access instructions..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} icon={<Sparkles className="w-4 h-4" />}>
                Publish Listing with Media
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

