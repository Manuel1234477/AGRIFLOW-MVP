import type { DemandRequest, CommodityType, QualityGrade } from '../types';
import { apiFetch } from '../lib/api';
import { storageService, STORE_KEYS } from './storageService';
import { auditService } from './auditService';

function normalizeDemand(raw: any): DemandRequest {
  return {
    id: raw.id,
    buyerId: raw.buyerId || raw.buyer_id,
    buyerName: raw.buyerName || raw.buyer_name || 'Buyer',
    commodity: raw.commodity,
    quantity: typeof raw.quantity === 'string' ? parseFloat(raw.quantity) : raw.quantity,
    unit: raw.unit || 'tonnes',
    qualityGrade: raw.qualityGrade || raw.quality_grade || 'A',
    destinationLocation: raw.destinationLocation || raw.destination_location,
    requiredByDate: raw.requiredByDate || raw.required_by_date,
    indicativeBudget: typeof raw.indicativeBudget === 'string' ? parseFloat(raw.indicativeBudget) : (raw.indicative_budget ? parseFloat(raw.indicative_budget) : raw.indicativeBudget || 0),
    currency: raw.currency || 'NGN',
    notes: raw.notes || undefined,
    status: raw.status || 'open',
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
  };
}

export const demandService = {
  async fetchAll(): Promise<DemandRequest[]> {
    try {
      const data = await apiFetch<any[]>('/api/demands');
      const normalized = data.map(normalizeDemand);
      return normalized;
    } catch {
      return this.getAll();
    }
  },

  async fetchMine(): Promise<DemandRequest[]> {
    try {
      const data = await apiFetch<any[]>('/api/demands/mine');
      const normalized = data.map(normalizeDemand);
      return normalized;
    } catch {
      const session = storageService.get<any>(STORE_KEYS.SESSION);
      if (!session?.userId) return [];
      return this.getForBuyer(session.userId);
    }
  },

  async fetchById(id: string): Promise<DemandRequest | null> {
    try {
      const data = await apiFetch<any>(`/api/demands/${id}`);
      return normalizeDemand(data);
    } catch {
      return this.getById(id);
    }
  },

  async create(params: {
    buyerId: string;
    buyerName: string;
    commodity: CommodityType;
    quantity: number;
    unit: string;
    qualityGrade: QualityGrade;
    destinationLocation: string;
    requiredByDate: string;
    indicativeBudget: number;
    currency: string;
    notes?: string;
  }): Promise<DemandRequest> {
    try {
      const data = await apiFetch<any>('/api/demands', {
        method: 'POST',
        body: JSON.stringify({
          commodity: params.commodity,
          quantity: params.quantity,
          unit: params.unit,
          qualityGrade: params.qualityGrade,
          destinationLocation: params.destinationLocation,
          requiredByDate: params.requiredByDate,
          indicativeBudget: params.indicativeBudget,
          currency: params.currency,
          notes: params.notes,
        }),
      });

      const demand = normalizeDemand(data);
      const all = storageService.get<DemandRequest[]>(STORE_KEYS.DEMANDS) ?? [];
      all.unshift(demand);
      storageService.set(STORE_KEYS.DEMANDS, all);

      auditService.log({
        action: 'demand_created',
        actorId: params.buyerId,
        actorName: params.buyerName,
        actorRole: 'buyer',
        entityId: demand.id,
        entityType: 'DemandRequest',
        detail: `Demand for ${params.quantity} ${params.unit} of ${params.commodity}, delivery to ${params.destinationLocation}.`,
      });

      return demand;
    } catch (apiErr) {
      // Fallback local creation if offline
      const now = new Date().toISOString();
      const n = String(Date.now()).slice(-5);
      const demand: DemandRequest = {
        id: `DEM-AGF-${n}`,
        ...params,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };
      const all = storageService.get<DemandRequest[]>(STORE_KEYS.DEMANDS) ?? [];
      all.unshift(demand);
      storageService.set(STORE_KEYS.DEMANDS, all);
      return demand;
    }
  },

  getAll(): DemandRequest[] {
    const raw = storageService.get<any[]>(STORE_KEYS.DEMANDS) ?? [];
    return raw.map(normalizeDemand);
  },

  getById(id: string): DemandRequest | null {
    return this.getAll().find((d) => d.id === id) ?? null;
  },

  getForBuyer(buyerId: string): DemandRequest[] {
    return this.getAll().filter((d) => d.buyerId === buyerId);
  },

  getByBuyer(buyerId: string): DemandRequest[] {
    return this.getForBuyer(buyerId);
  },

  async updateStatus(demandId: string, status: DemandRequest['status']): Promise<void> {
    const all = storageService.get<DemandRequest[]>(STORE_KEYS.DEMANDS) ?? [];
    const idx = all.findIndex((d) => d.id === demandId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
      storageService.set(STORE_KEYS.DEMANDS, all);
    }
  },
};
