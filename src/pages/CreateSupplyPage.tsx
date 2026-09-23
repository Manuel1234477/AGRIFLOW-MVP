import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supplyService } from '../services/supplyService';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import type { CommodityType, QualityGrade } from '../types';

export function CreateSupplyPage() {
  const navigate = useNavigate();
  const { session } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    commodity: 'maize' as CommodityType,
    quantity: '', unit: 'tonnes',
    qualityGrade: 'A' as QualityGrade,
    pricePerUnit: '',
    location: session?.role === 'supplier' ? '' : '',
    availabilityDate: '',
    description: '',
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
      });
      toast('success', `Listing ${l.id} published.`);
      navigate('/app/supply/manage');
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Supply Listing</h1>
          <p className="text-sm text-gray-500">Publish your available agricultural supply for buyers to discover.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Select label="Commodity" value={form.commodity} onChange={(e) => set('commodity', e.target.value)} required>
                <option value="maize">Yellow Maize</option>
                <option value="rice">Rice</option>
                <option value="soybean">Soybean</option>
                <option value="sorghum">White Sorghum</option>
                <option value="beans">Beans</option>
                <option value="yam">Yam</option>
                <option value="wheat">Wheat</option>
                <option value="cassava">Cassava</option>
              </Select>
              <Select label="Quality Grade" value={form.qualityGrade} onChange={(e) => set('qualityGrade', e.target.value)} required>
                <option value="A">Grade A (Premium)</option>
                <option value="B">Grade B (Standard)</option>
                <option value="C">Grade C (Commercial)</option>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Quantity" type="number" required min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="e.g. 50" />
              <Select label="Unit" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                <option value="tonnes">Tonnes (MT)</option>
                <option value="bags (50kg)">Bags (50kg)</option>
                <option value="bags (100kg)">Bags (100kg)</option>
                <option value="bags (25kg)">Bags (25kg)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="crates">Crates</option>
                <option value="baskets">Baskets</option>
              </Select>
            </div>

            <Input
              label="Price per Unit (₦)" type="number" required min="1"
              value={form.pricePerUnit} onChange={(e) => set('pricePerUnit', e.target.value)}
              placeholder="e.g. 850000"
              hint="Price in Nigerian Naira per selected unit"
            />

            <Input
              label="Location / Origin" required
              value={form.location} onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Kaduna, Nigeria"
            />

            <Input
              label="Availability Date" type="date" required
              value={form.availabilityDate} onChange={(e) => set('availabilityDate', e.target.value)}
            />

            <Textarea
              label="Description"
              value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={4}
              placeholder="Quality details, processing method, certifications, collection instructions..."
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" loading={loading}>Publish Listing</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
