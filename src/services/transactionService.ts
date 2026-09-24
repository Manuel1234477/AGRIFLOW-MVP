import type {
  Transaction, TransactionStatus, UserRole, SupplyListing, DemandRequest, Payment, LogisticsJob
} from '../types';
import { apiFetch } from '../lib/api';
import { storageService, STORE_KEYS } from './storageService';
import { canActorTransition, getPipelineIndex } from './transactionStateMachine';
import { auditService } from './auditService';

function reconcileTransactionWithState(txn: Transaction): { txn: Transaction; changed: boolean } {
  const payments = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
  const jobs = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];

  const payment = payments.find((p) => p.transactionId === txn.id || (txn.paymentId && p.id === txn.paymentId));
  const job = jobs.find((j) => j.transactionId === txn.id || (txn.logisticsJobId && j.id === txn.logisticsJobId));

  let status = txn.status;
  const paymentId = txn.paymentId || payment?.id;
  const logisticsJobId = txn.logisticsJobId || job?.id;

  const logisticsToTxnStatus: Record<string, TransactionStatus> = {
    COMPLETED: 'COMPLETED',
    DELIVERED: 'DELIVERED',
    IN_TRANSIT: 'IN_TRANSIT',
    PICKED_UP: 'PICKED_UP',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    ACCEPTED: 'LOGISTICS_ACCEPTED',
    ASSIGNED: 'LOGISTICS_ASSIGNED',
    PENDING: 'LOGISTICS_PENDING',
  };

  if (job && logisticsToTxnStatus[job.status]) {
    const jobMappedStatus = logisticsToTxnStatus[job.status];
    if (getPipelineIndex(jobMappedStatus) > getPipelineIndex(status)) {
      status = jobMappedStatus;
    }
  } else if (payment && payment.status === 'CONFIRMED') {
    if (getPipelineIndex('PAYMENT_CONFIRMED') > getPipelineIndex(status)) {
      status = 'PAYMENT_CONFIRMED';
    }
  }

  if (paymentId !== txn.paymentId || logisticsJobId !== txn.logisticsJobId || status !== txn.status) {
    return {
      txn: {
        ...txn,
        status,
        paymentId,
        logisticsJobId,
      },
      changed: true,
    };
  }

  return { txn, changed: false };
}

function normalizeTransaction(raw: any): Transaction {
  const t: Transaction = {
    id: raw.id,
    listingId: raw.listingId || raw.listing_id,
    demandId: raw.demandId || raw.demand_id || undefined,
    buyerId: raw.buyerId || raw.buyer_id,
    buyerName: raw.buyerName || raw.buyer_name || 'Buyer',
    supplierId: raw.supplierId || raw.supplier_id,
    supplierName: raw.supplierName || raw.supplier_name || 'Supplier',
    commodity: raw.commodity,
    quantity: typeof raw.quantity === 'string' ? parseFloat(raw.quantity) : raw.quantity,
    unit: raw.unit || 'tonnes',
    qualityGrade: raw.qualityGrade || raw.quality_grade || 'A',
    pricePerUnit: typeof raw.pricePerUnit === 'string' ? parseFloat(raw.pricePerUnit) : (raw.price_per_unit ? parseFloat(raw.price_per_unit) : raw.pricePerUnit || 0),
    totalAmount: typeof raw.totalAmount === 'string' ? parseFloat(raw.totalAmount) : (raw.total_amount ? parseFloat(raw.total_amount) : raw.totalAmount || 0),
    currency: raw.currency || 'NGN',
    pickupLocation: raw.pickupLocation || raw.pickup_location,
    deliveryLocation: raw.deliveryLocation || raw.delivery_location,
    expectedDeliveryDate: raw.expectedDeliveryDate || raw.expected_delivery_date || new Date().toISOString(),
    status: (raw.status || 'PENDING').toUpperCase() as TransactionStatus,
    paymentId: raw.paymentId || raw.payment_id || undefined,
    logisticsJobId: raw.logisticsJobId || raw.logistics_job_id || undefined,
    disputeId: raw.disputeId || raw.dispute_id || undefined,
    history: Array.isArray(raw.history)
      ? raw.history.map((h: any) => ({
          status: (h.status || '').toUpperCase() as TransactionStatus,
          timestamp: h.timestamp || h.createdAt || h.created_at || new Date().toISOString(),
          actor: h.actor || 'System',
          actorRole: (h.actorRole || h.actor_role || 'system') as UserRole | 'system',
          note: h.note || undefined,
        }))
      : [
          {
            status: (raw.status || 'PENDING').toUpperCase() as TransactionStatus,
            timestamp: raw.updatedAt || raw.updated_at || raw.createdAt || raw.created_at || new Date().toISOString(),
            actor: raw.supplierName || raw.buyerName || 'System',
            actorRole: 'system',
            note: 'Initial state',
          },
        ],
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
  };

  const { txn } = reconcileTransactionWithState(t);
  return txn;
}

export const transactionService = {
  // Syncs the local transaction cache from a response another service
  // already fetched (e.g. paymentService's confirm/fail calls, which get a
  // TransactionWithHistory back from their own endpoint) -- avoids a
  // redundant re-fetch just to update local state.
  applyServerTransaction(raw: any): Transaction {
    const rawTx = raw.transaction ? { ...raw.transaction, history: raw.history } : raw;
    const txn = normalizeTransaction(rawTx);
    const all = storageService.get<Transaction[]>(STORE_KEYS.TRANSACTIONS) ?? [];
    const idx = all.findIndex((t) => t.id === txn.id);
    if (idx >= 0) all[idx] = txn;
    else all.unshift(txn);
    storageService.set(STORE_KEYS.TRANSACTIONS, all);
    return txn;
  },

  async fetchAll(): Promise<Transaction[]> {
    try {
      const data = await apiFetch<any[]>('/api/transactions');
      const normalized = data.map(normalizeTransaction);
      return normalized;
    } catch {
      return this.getAll();
    }
  },

  async fetchMine(): Promise<Transaction[]> {
    try {
      const data = await apiFetch<any[]>('/api/transactions');
      const normalized = data.map(normalizeTransaction);
      return normalized;
    } catch {
      const session = storageService.get<any>(STORE_KEYS.SESSION);
      if (!session?.userId) return [];
      if (session.role === 'buyer') return this.getForBuyer(session.userId);
      if (session.role === 'supplier') return this.getForSupplier(session.userId);
      return this.getAll();
    }
  },

  async fetchById(id: string): Promise<Transaction | null> {
    try {
      const data = await apiFetch<any>(`/api/transactions/${id}`);
      const rawTx = data.transaction ? { ...data.transaction, history: data.history } : data;
      return normalizeTransaction(rawTx);
    } catch {
      return this.getById(id);
    }
  },

  async create(params: {
    listing: SupplyListing;
    demand?: DemandRequest;
    buyerId: string;
    buyerName: string;
    quantity: number;
    deliveryLocation: string;
    expectedDeliveryDate: string;
  }): Promise<Transaction> {
    try {
      const data = await apiFetch<any>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          listingId: params.listing.id,
          demandId: params.demand?.id || null,
          quantity: params.quantity,
          deliveryLocation: params.deliveryLocation,
          expectedDeliveryDate: params.expectedDeliveryDate,
        }),
      });

      const rawTx = data.transaction ? { ...data.transaction, history: data.history } : data;
      const txn = normalizeTransaction(rawTx);
      const all = storageService.get<Transaction[]>(STORE_KEYS.TRANSACTIONS) ?? [];
      all.unshift(txn);
      storageService.set(STORE_KEYS.TRANSACTIONS, all);

      auditService.log({
        action: 'transaction_initiated',
        actorId: params.buyerId,
        actorName: params.buyerName,
        actorRole: 'buyer',
        entityId: txn.id,
        entityType: 'Transaction',
        transactionId: txn.id,
        detail: `Transaction ${txn.id} initiated for ${params.quantity} ${params.listing.unit} of ${params.listing.commodity}. Value: ₦${txn.totalAmount.toLocaleString()}.`,
      });

      return txn;
    } catch (apiErr) {
      const now = new Date().toISOString();
      const n = String(Math.floor(Math.random() * 90000) + 10000);
      const txn: Transaction = {
        id: `TXN-AGF-${n}`,
        listingId: params.listing.id,
        demandId: params.demand?.id,
        buyerId: params.buyerId,
        buyerName: params.buyerName,
        supplierId: params.listing.supplierId,
        supplierName: params.listing.supplierName,
        commodity: params.listing.commodity,
        quantity: params.quantity,
        unit: params.listing.unit,
        qualityGrade: params.listing.qualityGrade,
        pricePerUnit: params.listing.pricePerUnit,
        totalAmount: params.quantity * params.listing.pricePerUnit,
        currency: params.listing.currency,
        pickupLocation: params.listing.location,
        deliveryLocation: params.deliveryLocation,
        expectedDeliveryDate: params.expectedDeliveryDate,
        status: 'PENDING',
        history: [
          {
            status: 'PENDING',
            timestamp: now,
            actor: params.buyerName,
            actorRole: 'buyer',
            note: 'Transaction initiated by buyer.',
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const all = storageService.get<Transaction[]>(STORE_KEYS.TRANSACTIONS) ?? [];
      all.unshift(txn);
      storageService.set(STORE_KEYS.TRANSACTIONS, all);
      return txn;
    }
  },

  async transition(params: {
    transactionId: string;
    to: TransactionStatus;
    actorId: string;
    actorName: string;
    actorRole: UserRole | 'system';
    note?: string;
  }): Promise<Transaction> {
    try {
      const data = await apiFetch<any>(`/api/transactions/${params.transactionId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          to: params.to,
          note: params.note,
        }),
      });

      const rawTx = data.transaction ? { ...data.transaction, history: data.history } : data;
      const updated = normalizeTransaction(rawTx);
      const all = storageService.get<Transaction[]>(STORE_KEYS.TRANSACTIONS) ?? [];
      const idx = all.findIndex((t) => t.id === params.transactionId);
      if (idx >= 0) all[idx] = updated;
      storageService.set(STORE_KEYS.TRANSACTIONS, all);
      return updated;
    } catch (apiErr) {
      const all = storageService.get<Transaction[]>(STORE_KEYS.TRANSACTIONS) ?? [];
      const idx = all.findIndex((t) => t.id === params.transactionId);
      if (idx < 0) throw apiErr;
      const txn = all[idx];

      const { allowed, reason } = canActorTransition(txn.status, params.to, params.actorRole);
      if (!allowed) throw new Error(reason ?? 'Transition not allowed.');

      const now = new Date().toISOString();
      const updated: Transaction = {
        ...txn,
        status: params.to,
        updatedAt: now,
        history: [
          ...txn.history,
          {
            status: params.to,
            timestamp: now,
            actor: params.actorName,
            actorRole: params.actorRole,
            note: params.note,
          },
        ],
      };

      all[idx] = updated;
      storageService.set(STORE_KEYS.TRANSACTIONS, all);
      return updated;
    }
  },

  getAll(): Transaction[] {
    const raw = storageService.get<any[]>(STORE_KEYS.TRANSACTIONS) ?? [];
    return raw.map(normalizeTransaction);
  },

  getById(id: string): Transaction | null {
    return this.getAll().find((t) => t.id === id) ?? null;
  },

  getForBuyer(buyerId: string): Transaction[] {
    return this.getAll().filter((t) => t.buyerId === buyerId);
  },

  getByBuyer(buyerId: string): Transaction[] {
    return this.getForBuyer(buyerId);
  },

  async initiate(params: {
    listingId: string;
    buyerId: string;
    buyerName: string;
    quantity: number;
    deliveryLocation: string;
    expectedDeliveryDate: string;
  }): Promise<Transaction> {
    let listing = storageService.get<SupplyListing[]>(STORE_KEYS.LISTINGS)?.find((l) => l.id === params.listingId);
    if (!listing) {
      try {
        const raw = await apiFetch<any>(`/api/listings/${params.listingId}`);
        listing = {
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
          status: (raw.status || 'active').toLowerCase() as any,
          createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
          updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
        };
      } catch {
        // ignore
      }
    }
    if (!listing) throw new Error('Listing not found');
    return this.create({
      listing,
      buyerId: params.buyerId,
      buyerName: params.buyerName,
      quantity: params.quantity,
      deliveryLocation: params.deliveryLocation,
      expectedDeliveryDate: params.expectedDeliveryDate,
    });
  },

  getForSupplier(supplierId: string): Transaction[] {
    return this.getAll().filter((t) => t.supplierId === supplierId);
  },

  updateField<K extends keyof Transaction>(id: string, key: K, value: Transaction[K]): void {
    const all = storageService.get<Transaction[]>(STORE_KEYS.TRANSACTIONS) ?? [];
    const idx = all.findIndex((t) => t.id === id);
    if (idx >= 0) {
      (all[idx] as any)[key] = value;
      all[idx].updatedAt = new Date().toISOString();
      storageService.set(STORE_KEYS.TRANSACTIONS, all);
    }
  },
};
