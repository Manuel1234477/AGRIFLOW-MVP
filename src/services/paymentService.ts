import type { Payment, PaymentStatus } from '../types';
import { storageService, STORE_KEYS } from './storageService';
import { transactionService } from './transactionService';
import { auditService } from './auditService';
import { logisticsService } from './logisticsService';

function generateId(transactionId: string): string {
  const n = transactionId.split('-').pop() ?? String(Date.now()).slice(-5);
  return `PAY-AGF-${n}`;
}

function generateProviderRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `AF-PAY-${date}-${rand}`;
}

export const paymentService = {
  async initiate(params: {
    transactionId: string;
    payerId: string;
    payerName: string;
    amount: number;
    currency: string;
  }): Promise<Payment> {
    await delay(400);

    // Idempotency: check existing payment for this transaction
    const existing = this.getForTransaction(params.transactionId);
    if (existing) {
      if (existing.status === 'CONFIRMED') {
        // Ensure underlying transaction status is synchronized
        const txn = transactionService.getById(params.transactionId);
        if (txn && (txn.status === 'PAYMENT_PENDING' || txn.status === 'ACCEPTED')) {
          await this.confirm(existing.id);
        }
        return existing;
      }
      if (existing.status === 'PENDING') {
        return existing;
      }
    }

    // Transition transaction to PAYMENT_PENDING if not already
    const currentTxn = transactionService.getById(params.transactionId);
    if (currentTxn && currentTxn.status === 'ACCEPTED') {
      await transactionService.transition({
        transactionId: params.transactionId,
        to: 'PAYMENT_PENDING',
        actorId: params.payerId,
        actorName: params.payerName,
        actorRole: 'buyer',
        note: 'Buyer initiated payment.',
      });
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: generateId(params.transactionId),
      transactionId: params.transactionId,
      payerId: params.payerId,
      amount: params.amount,
      currency: params.currency,
      provider: 'AgriFlow Escrow Service',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    auditService.log({
      action: 'payment_initiated',
      actorId: params.payerId,
      actorName: params.payerName,
      actorRole: 'buyer',
      entityId: payment.id,
      entityType: 'Payment',
      transactionId: params.transactionId,
      detail: `Payment ${payment.id} initiated for ₦${params.amount.toLocaleString()}.`,
    });

    const all = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
    all.push(payment);
    storageService.set(STORE_KEYS.PAYMENTS, all);

    // Link payment to transaction
    transactionService.updateField(params.transactionId, 'paymentId', payment.id);

    return payment;
  },

  async confirm(paymentId: string, _actorId?: string, _actorName?: string): Promise<Payment> {
    await delay(600); // simulated processing time

    const all = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
    const idx = all.findIndex((p) => p.id === paymentId);
    if (idx < 0) throw new Error('Payment not found.');
    const payment = all[idx];

    const now = new Date().toISOString();
    const updated: Payment = {
      ...payment,
      status: 'CONFIRMED',
      providerReference: payment.providerReference || generateProviderRef(),
      updatedAt: now,
      completedAt: payment.completedAt || now,
    };
    all[idx] = updated;
    storageService.set(STORE_KEYS.PAYMENTS, all);

    // Synchronize transaction state to PAYMENT_CONFIRMED & LOGISTICS_PENDING
    const txn = transactionService.getById(payment.transactionId);
    if (txn && (txn.status === 'PAYMENT_PENDING' || txn.status === 'ACCEPTED')) {
      await transactionService.transition({
        transactionId: payment.transactionId,
        to: 'PAYMENT_CONFIRMED',
        actorId: 'system',
        actorName: 'AgriFlow System',
        actorRole: 'system',
        note: `Payment confirmed. Provider ref: ${updated.providerReference}`,
      });

      // Auto-create logistics job — idempotent
      await logisticsService.createJobForTransaction(payment.transactionId);
    }

    return updated;
  },

  async fail(paymentId: string, reason: string): Promise<Payment> {
    await delay(800);
    const all = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
    const idx = all.findIndex((p) => p.id === paymentId);
    if (idx < 0) throw new Error('Payment not found.');
    const payment = all[idx];
    const now = new Date().toISOString();
    const updated: Payment = { ...payment, status: 'FAILED', failureReason: reason, updatedAt: now };
    all[idx] = updated;
    storageService.set(STORE_KEYS.PAYMENTS, all);

    await transactionService.transition({
      transactionId: payment.transactionId,
      to: 'PAYMENT_FAILED',
      actorId: 'system',
      actorName: 'AgriFlow System',
      actorRole: 'system',
      note: `Payment failed: ${reason}`,
    });

    return updated;
  },

  getForTransaction(transactionId: string): Payment | null {
    const all = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
    return all.find((p) => p.transactionId === transactionId) ?? null;
  },

  getAll(): Payment[] {
    return storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
  },

  getById(id: string): Payment | null {
    return this.getAll().find((p) => p.id === id) ?? null;
  },

  updatePaymentStatus(paymentId: string, status: PaymentStatus): void {
    const all = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
    const idx = all.findIndex((p) => p.id === paymentId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
      storageService.set(STORE_KEYS.PAYMENTS, all);
    }
  },
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
