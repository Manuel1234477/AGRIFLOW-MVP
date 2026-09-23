import type { LogisticsJob, LogisticsStatus, ProofOfDelivery, User } from '../types';
import { storageService, STORE_KEYS } from './storageService';
import { transactionService } from './transactionService';
import { notificationService } from './notificationService';
import { getKnownUsersByRole } from './knownUsersDirectory';

function generateId(): string {
  const n = String(Math.floor(Math.random() * 90000) + 10000);
  return `LOG-AGF-${n}`;
}

export const logisticsService = {
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

    // The backend transaction is already at LOGISTICS_PENDING — driven by
    // paymentService.confirm()'s call to POST /transactions/:id/payment/confirm,
    // which performs PAYMENT_CONFIRMED -> LOGISTICS_PENDING atomically. This
    // is purely the local job record.
    return job;
  },

  async assignProvider(jobId: string, providerId: string, providerName: string, adminId: string, adminName: string): Promise<LogisticsJob> {
    await delay(500);
    const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
    const idx = all.findIndex((j) => j.id === jobId);
    if (idx < 0) throw new Error('Logistics job not found.');
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
  },

  async claimJob(jobId: string, providerId: string, providerName: string): Promise<LogisticsJob> {
    await delay(300);
    const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
    const idx = all.findIndex((j) => j.id === jobId);
    if (idx < 0) throw new Error('Logistics job not found.');
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
  },

  async updateJobStatus(params: {
    jobId: string;
    status: LogisticsStatus;
    providerId: string;
    providerName: string;
    proofOfDelivery?: ProofOfDelivery;
  }): Promise<LogisticsJob> {
    await delay(400);
    const all = storageService.get<LogisticsJob[]>(STORE_KEYS.LOGISTICS_JOBS) ?? [];
    const idx = all.findIndex((j) => j.id === params.jobId);
    if (idx < 0) throw new Error('Logistics job not found.');
    const job = all[idx];

    if (job.providerId !== params.providerId) {
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

    // Map logistics status to transaction status
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

  // See knownUsersDirectory.ts — this is only every logistics-role user
  // who has registered/logged in on this browser, not a full directory
  // (the backend has no GET /users endpoint yet).
  getProviders(): Omit<User, 'passwordHash'>[] {
    return getKnownUsersByRole('logistics');
  },
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
