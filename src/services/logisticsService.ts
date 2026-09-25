import type { LogisticsJob, LogisticsStatus, ProofOfDelivery, User } from '../types';
import { apiFetch } from '../lib/api';
import { mapLogisticsJob } from './apiMappers';
import { storageService, STORE_KEYS } from './storageService';
import { transactionService } from './transactionService';
import { notificationService } from './notificationService';
import { getKnownUsersByRole } from './knownUsersDirectory';
import { adminService } from './adminService';

function generateId(): string {
  const n = String(Math.floor(Math.random() * 90000) + 10000);
  return `LOG-AGF-${n}`;
}

export const logisticsService = {
  async fetchAll(): Promise<LogisticsJob[]> {
    try {
      const data = await apiFetch<any[]>('/api/logistics/jobs');
      const mapped = data.map(mapLogisticsJob);
      storageService.set(STORE_KEYS.LOGISTICS_JOBS, mapped);
      return mapped;
    } catch {
      return this.getAll();
    }
  },

  async fetchMine(): Promise<LogisticsJob[]> {
    return this.fetchAll();
  },

  async fetchById(id: string): Promise<LogisticsJob | null> {
    const all = await this.fetchAll();
    return all.find((j) => j.id === id) ?? this.getById(id);
  },

  async fetchProviders(): Promise<Omit<User, 'passwordHash'>[]> {
    try {
      const { users } = await adminService.fetchUsers({ role: 'logistics', limit: 100 });
      if (users.length > 0) return users;
      return this.getProviders();
    } catch {
      return this.getProviders();
    }
  },

  // Called automatically after payment is confirmed — idempotent
  async createJobForTransaction(transactionId: string): Promise<LogisticsJob | null> {
    const existing = this.getForTransaction(transactionId);
    if (existing) return existing; // idempotent

    const txn = await transactionService.getById(transactionId);
    if (!txn) throw new Error('Transaction not found.');

    const now = new Date().toISOString();
    const job: LogisticsJob = {
      id: generateId(),
      transactionId,
      commodity: txn.commodity,
      quantity: txn.quantity,
      unit: txn.unit,
      pickupLocation: txn.pickupLocation,
      deliveryLocation: txn.deliveryLocation,
      pickupDate: now,
      expectedDeliveryDate: txn.expectedDeliveryDate,
      logisticsCost: Math.round(txn.totalAmount * 0.03), // 3% estimate
      currency: txn.currency,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
    all.push(job);
    storageService.set(STORE_KEYS.LOGISTICS_JOBS, all);

    return job;
  },

  async assignProvider(
    jobId: string,
    providerId: string,
    providerName: string,
    adminId: string,
    adminName: string
  ): Promise<LogisticsJob> {
    try {
      const data = await apiFetch<any>(`/api/logistics/jobs/${jobId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ providerId }),
      });
      const updated = mapLogisticsJob(data);

      const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
      const idx = all.findIndex((j) => j.id === jobId);
      if (idx >= 0) all[idx] = updated;
      else all.push(updated);
      storageService.set(STORE_KEYS.LOGISTICS_JOBS, all);

      notificationService.create({
        userId: providerId,
        type: 'logistics_assigned',
        title: 'New Logistics Assignment',
        message: `You have been assigned a logistics job: ${updated.commodity} ${updated.quantity} ${updated.unit} from ${updated.pickupLocation} to ${updated.deliveryLocation}. Job: ${updated.id}`,
        transactionId: updated.transactionId,
      });

      return updated;
    } catch (apiErr) {
      await delay(300);
      const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
      const idx = all.findIndex((j) => j.id === jobId);
      if (idx < 0) throw apiErr instanceof Error ? apiErr : new Error('Logistics job not found.');
      const job = all[idx];

      const now = new Date().toISOString();
      const updated: LogisticsJob = { ...job, providerId, providerName, status: 'ASSIGNED', updatedAt: now };
      all[idx] = updated;
      storageService.set(STORE_KEYS.LOGISTICS_JOBS, all);

      await transactionService.transition({
        transactionId: job.transactionId,
        to: 'LOGISTICS_ASSIGNED',
        actorId: adminId,
        actorName: adminName,
        actorRole: 'admin',
        note: `${providerName} assigned as logistics provider.`,
      });

      notificationService.create({
        userId: providerId,
        type: 'logistics_assigned',
        title: 'New Logistics Assignment',
        message: `You have been assigned a logistics job: ${job.commodity} ${job.quantity} ${job.unit} from ${job.pickupLocation} to ${job.deliveryLocation}. Job: ${job.id}`,
        transactionId: job.transactionId,
      });

      return updated;
    }
  },

  async claimJob(jobId: string, providerId: string, providerName: string): Promise<LogisticsJob> {
    try {
      const data = await apiFetch<any>(`/api/logistics/jobs/${jobId}/claim`, {
        method: 'POST',
      });
      const updated = mapLogisticsJob(data);

      const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
      const idx = all.findIndex((j) => j.id === jobId);
      if (idx >= 0) all[idx] = updated;
      else all.push(updated);
      storageService.set(STORE_KEYS.LOGISTICS_JOBS, all);

      return updated;
    } catch (apiErr) {
      await delay(300);
      const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
      const idx = all.findIndex((j) => j.id === jobId);
      if (idx < 0) throw apiErr instanceof Error ? apiErr : new Error('Logistics job not found.');
      const job = all[idx];

      const now = new Date().toISOString();
      const updated: LogisticsJob = { ...job, providerId, providerName, status: 'ASSIGNED', updatedAt: now };
      all[idx] = updated;
      storageService.set(STORE_KEYS.LOGISTICS_JOBS, all);

      await transactionService.transition({
        transactionId: job.transactionId,
        to: 'LOGISTICS_ASSIGNED',
        actorId: providerId,
        actorName: providerName,
        actorRole: 'logistics',
        note: `${providerName} claimed the logistics assignment.`,
      });

      return updated;
    }
  },

  async updateJobStatus(params: {
    jobId: string;
    status: LogisticsStatus;
    providerId: string;
    providerName: string;
    proofOfDelivery?: ProofOfDelivery;
  }): Promise<LogisticsJob> {
    try {
      const data = await apiFetch<any>(`/api/logistics/jobs/${params.jobId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: params.status,
          proofOfDelivery: params.proofOfDelivery,
        }),
      });
      const updated = mapLogisticsJob(data);

      const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
      const idx = all.findIndex((j) => j.id === params.jobId);
      if (idx >= 0) all[idx] = updated;
      else all.push(updated);
      storageService.set(STORE_KEYS.LOGISTICS_JOBS, all);

      return updated;
    } catch (apiErr) {
      await delay(400);
      const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
      const idx = all.findIndex((j) => j.id === params.jobId);
      if (idx < 0) throw apiErr instanceof Error ? apiErr : new Error('Logistics job not found.');
      const job = all[idx];

      if (job.providerId && job.providerId !== params.providerId) {
        throw new Error('Unauthorized: this job is not assigned to you.');
      }

      const now = new Date().toISOString();
      const updated: LogisticsJob = {
        ...job,
        status: params.status,
        updatedAt: now,
        proofOfDelivery: params.proofOfDelivery ?? job.proofOfDelivery,
      };
      all[idx] = updated;
      storageService.set(STORE_KEYS.LOGISTICS_JOBS, all);

      const txnStatusMap: Partial<Record<LogisticsStatus, import('../types').TransactionStatus>> = {
        ACCEPTED: 'LOGISTICS_ACCEPTED',
        REJECTED: 'LOGISTICS_REJECTED',
        READY_FOR_PICKUP: 'READY_FOR_PICKUP',
        PICKED_UP: 'PICKED_UP',
        IN_TRANSIT: 'IN_TRANSIT',
        DELIVERED: 'DELIVERED',
        COMPLETED: 'COMPLETED',
      };

      const txnStatus = txnStatusMap[params.status];
      if (txnStatus) {
        await transactionService.transition({
          transactionId: job.transactionId,
          to: txnStatus,
          actorId: params.providerId,
          actorName: params.providerName,
          actorRole: 'logistics',
          note: `Shipment status updated to ${params.status}.`,
        });
      }

      return updated;
    }
  },

  async acceptJob(jobId: string, providerId: string, providerName: string): Promise<LogisticsJob> {
    return this.updateJobStatus({ jobId, status: 'ACCEPTED', providerId, providerName });
  },

  async rejectJob(jobId: string, _reason: string, providerId: string, providerName: string): Promise<LogisticsJob> {
    return this.updateJobStatus({ jobId, status: 'REJECTED', providerId, providerName });
  },

  getForTransaction(transactionId: string): LogisticsJob | null {
    const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
    return all.find((j) => j.transactionId === transactionId) ?? null;
  },

  getForProvider(providerId: string): LogisticsJob[] {
    const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
    return all.filter((j) => j.providerId === providerId);
  },

  getAll(): LogisticsJob[] {
    return storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
  },

  getById(id: string): LogisticsJob | null {
    return this.getAll().find((j) => j.id === id) ?? null;
  },

  getPending(): LogisticsJob[] {
    return this.getAll().filter((j) => j.status === 'PENDING');
  },

  getProviders(): Omit<User, 'passwordHash'>[] {
    return getKnownUsersByRole('logistics');
  },
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

