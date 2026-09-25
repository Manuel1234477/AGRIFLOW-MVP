import type { SupplyListing, ListingStatus, CommodityType, QualityGrade, ListingMedia, InspectionDetails } from '../types';
import { apiFetch } from '../lib/api';
import { storageService, STORE_KEYS } from './storageService';
import { auditService } from './auditService';
import { normalizeMedia } from './mediaService';

function normalizeListing(raw: any): SupplyListing {
  return {
    id: raw.id,
    supplierId: raw.supplierId || raw.supplier_id,
    supplierName: raw.supplierName || raw.supplier_name || 'Supplier',
    supplierVerified: raw.supplierVerified ?? raw.supplier_verified ?? true,
    commodity: raw.commodity,
    quantity: typeof raw.quantity === 'string' ? parseFloat(raw.quantity) : raw.quantity,
    unit: raw.unit || 'tonnes',
    qualityGrade: raw.qualityGrade || raw.quality_grade || 'A',
    pricePerUnit: typeof raw.pricePerUnit === 'string' ? parseFloat(raw.pricePerUnit) : (raw.price_per_unit ? parseFloat(raw.price_per_unit) : raw.pricePerUnit || 0),
    currency: raw.currency || 'NGN',
    location: raw.location,
    availabilityDate: raw.availabilityDate || raw.availability_date || new Date().toISOString(),
    description: raw.description || '',
    photos: raw.photos || undefined,
    videos: raw.videos || undefined,
    media: Array.isArray(raw.media) ? raw.media.map(normalizeMedia) : undefined,
    inspectionDetails: raw.inspectionDetails || undefined,
    status: (raw.status || 'active').toLowerCase() as ListingStatus,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
  };
}

export const supplyService = {
  async fetchAll(): Promise<SupplyListing[]> {
    try {
      const data = await apiFetch<any[]>('/api/listings');
      const normalized = data.map(normalizeListing);
      return normalized;
    } catch {
      return this.getAll();
    }
  },

  async fetchMine(): Promise<SupplyListing[]> {
    try {
      const data = await apiFetch<any[]>('/api/listings/mine');
      const normalized = data.map(normalizeListing);
      return normalized;
    } catch {
      const session = storageService.get<any>(STORE_KEYS.SESSION);
      if (!session?.userId) return [];
      return this.getForSupplier(session.userId);
    }
  },

  async fetchById(id: string): Promise<SupplyListing | null> {
    try {
      const data = await apiFetch<any>(`/api/listings/${id}`);
      return normalizeListing(data);
    } catch {
      return this.getById(id);
    }
  },

  async create(params: {
    supplierId: string;
    supplierName: string;
    supplierVerified: boolean;
    commodity: CommodityType;
    quantity: number;
    unit: string;
    qualityGrade: QualityGrade;
    pricePerUnit: number;
    currency: string;
    location: string;
    availabilityDate: string;
    description: string;
    photos?: string[];
    videos?: string[];
    media?: ListingMedia[];
    inspectionDetails?: InspectionDetails;
  }): Promise<SupplyListing> {
    const mediaIds = (params.media ?? [])
      .filter((m) => m.status === 'processing' || m.status === 'ready')
      .map((m) => m.id);

    try {
      const data = await apiFetch<any>('/api/listings', {
        method: 'POST',
        body: JSON.stringify({
          commodity: params.commodity,
          quantity: params.quantity,
          unit: params.unit,
          qualityGrade: params.qualityGrade,
          pricePerUnit: params.pricePerUnit,
          currency: params.currency,
          location: params.location,
          availabilityDate: params.availabilityDate,
          description: params.description,
          mediaIds,
        }),
      });

      // `data.media` is the server's record of the attached uploads.
      const listing = normalizeListing({
        ...data,
        inspectionDetails: params.inspectionDetails,
      });
      const all = storageService.get<SupplyListing[]>(STORE_KEYS.LISTINGS) ?? [];
      all.unshift(listing);
      storageService.set(STORE_KEYS.LISTINGS, all);

      auditService.log({
        action: 'supply_created',
        actorId: params.supplierId,
        actorName: params.supplierName,
        actorRole: 'supplier',
        entityId: listing.id,
        entityType: 'SupplyListing',
        detail: `${params.quantity} ${params.unit} of ${params.commodity} listed at ₦${params.pricePerUnit.toLocaleString()}/${params.unit}.`,
      });

      return listing;
    } catch (apiErr) {
      const now = new Date().toISOString();
      const n = String(Date.now()).slice(-5);
      const listing: SupplyListing = {
        id: `SUP-AGF-${n}`,
        ...params,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const all = storageService.get<SupplyListing[]>(STORE_KEYS.LISTINGS) ?? [];
      all.unshift(listing);
      storageService.set(STORE_KEYS.LISTINGS, all);
      return listing;
    }
  },

  async update(listingId: string, _supplierId: string, updates: Partial<SupplyListing>): Promise<SupplyListing> {
    try {
      const data = await apiFetch<any>(`/api/listings/${listingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          quantity: updates.quantity,
          pricePerUnit: updates.pricePerUnit,
          description: updates.description,
          status: updates.status,
        }),
      });

      const updated = normalizeListing(data);
      const all = storageService.get<SupplyListing[]>(STORE_KEYS.LISTINGS) ?? [];
      const idx = all.findIndex((l) => l.id === listingId);
      if (idx >= 0) all[idx] = updated;
      storageService.set(STORE_KEYS.LISTINGS, all);
      return updated;
    } catch {
      const all = storageService.get<SupplyListing[]>(STORE_KEYS.LISTINGS) ?? [];
      const idx = all.findIndex((l) => l.id === listingId);
      if (idx < 0) throw new Error('Listing not found.');
      const updated = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
      all[idx] = updated;
      storageService.set(STORE_KEYS.LISTINGS, all);
      return updated;
    }
  },

  async setStatus(listingId: string, supplierId: string, status: ListingStatus): Promise<SupplyListing> {
    return this.update(listingId, supplierId, { status });
  },

  getAll(): SupplyListing[] {
    const raw = storageService.get<any[]>(STORE_KEYS.LISTINGS) ?? [];
    return raw.map(normalizeListing);
  },

  getActive(): SupplyListing[] {
    return this.getAll().filter((l) => l.status === 'active');
  },

  getById(id: string): SupplyListing | null {
    return this.getAll().find((l) => l.id === id) ?? null;
  },

  getForSupplier(supplierId: string): SupplyListing[] {
    return this.getAll().filter((l) => l.supplierId === supplierId);
  },
};
