import type { Payment } from '../types';
import { apiFetch } from '../lib/api';
import { storageService, STORE_KEYS } from './storageService';
import { transactionService } from './transactionService';
import { auditService } from './auditService';
import { logisticsService } from './logisticsService';

function normalizePayment(raw: any): Payment {
  return {
    id: raw.id,
    transactionId: raw.transactionId ?? raw.transaction_id,
    payerId: raw.payerId ?? raw.payer_id,
    amount: typeof raw.amount === 'string' ? parseFloat(raw.amount) : raw.amount,
    currency: raw.currency,
    provider: raw.provider,
    providerReference: raw.providerReference ?? raw.provider_reference ?? undefined,
    status: raw.status,
    failureReason: raw.failureReason ?? raw.failure_reason ?? undefined,
    createdAt: raw.createdAt ?? raw.created_at,
    updatedAt: raw.updatedAt ?? raw.updated_at,
    completedAt: raw.completedAt ?? raw.completed_at ?? undefined,
  };
}

function saveLocal(payment: Payment): void {
  const all = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
  const idx = all.findIndex((p) => p.id === payment.id);
  if (idx >= 0) all[idx] = payment;
  else all.push(payment);
  storageService.set(STORE_KEYS.PAYMENTS, all);
}

export const paymentService = {
  // Backed by POST /transactions/:id/payment/initiate (buyer-scoped,
  // idempotent server-side). No client-side fallback: a payment record
  // that only ever existed in this browser's localStorage can't later be
  // confirmed by the backend (mock_confirm_payment now requires the row
  // `initiate` creates), so pretending this succeeded when the backend is
  // unreachable would just move the failure further down the flow.
  async initiate(params: {
    transactionId: string;
    payerId: string;
    payerName: string;
    amount: number;
    currency: string;
  }): Promise<Payment> {
    const currentTxn = transactionService.getById(params.transactionId);
    if (currentTxn && currentTxn.status === 'ACCEPTED') {
      try {
        await transactionService.transition({
          transactionId: params.transactionId,
          to: 'PAYMENT_PENDING',
          actorId: params.payerId,
          actorName: params.payerName,
          actorRole: 'buyer',
          note: 'Buyer initiated payment.',
        });
      } catch {
        // Already past ACCEPTED, or the backend is unreachable -- the
        // initiate call below is the one that actually needs to succeed,
        // so let it surface the real error rather than failing here on a
        // transition that may simply no longer be necessary.
      }
    }

    const raw = await apiFetch<unknown>(`/api/transactions/${params.transactionId}/payment/initiate`, {
      method: 'POST',
      body: JSON.stringify({ amount: params.amount, currency: params.currency }),
    });
    const payment = normalizePayment(raw);
    saveLocal(payment);

    auditService.log({
      action: 'payment_initiated',
      actorId: params.payerId,
      actorName: params.payerName,
      actorRole: 'buyer',
      entityId: payment.id,
      entityType: 'Payment',
      transactionId: params.transactionId,
      detail: `Payment ${payment.id} initiated for ${params.amount.toLocaleString()} ${params.currency}.`,
    });

    return payment;
  },

  // Backed by POST /transactions/:id/payment/confirm. `stellarTxHash` is
  // optional and only meaningful for the on-chain deposit path -- passing
  // it here is what makes it land in payments.stellar_tx_hash instead of
  // only ever existing in a component's local state.
  async confirm(paymentId: string, _actorId?: string, _actorName?: string, stellarTxHash?: string): Promise<Payment> {
    const existing = this.getById(paymentId);
    if (!existing) throw new Error('Payment not found.');

    const txnData = await apiFetch<any>(`/api/transactions/${existing.transactionId}/payment/confirm`, {
      method: 'POST',
      body: JSON.stringify(stellarTxHash ? { stellarTxHash } : {}),
    });

    // The confirm response is transaction-shaped (TransactionWithHistory),
    // not payment-shaped -- sync the local transaction cache from it so the
    // UI reflects the real server state (LOGISTICS_PENDING) immediately,
    // then fetch the authoritative payment record separately.
    transactionService.applyServerTransaction(txnData);

    const rawPayment = await apiFetch<unknown>(`/api/transactions/${existing.transactionId}/payment`);
    const payment = normalizePayment(rawPayment);
    saveLocal(payment);

    await logisticsService.createJobForTransaction(existing.transactionId);

    return payment;
  },

  // Backed by POST /transactions/:id/payment/fail.
  async fail(paymentId: string, reason: string): Promise<Payment> {
    const existing = this.getById(paymentId);
    if (!existing) throw new Error('Payment not found.');

    const txnData = await apiFetch<any>(`/api/transactions/${existing.transactionId}/payment/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    transactionService.applyServerTransaction(txnData);

    const rawPayment = await apiFetch<unknown>(`/api/transactions/${existing.transactionId}/payment`);
    const payment = normalizePayment(rawPayment);
    saveLocal(payment);

    return payment;
  },

  getForTransaction(transactionId: string): Payment | null {
    const all = storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
    return all.find((p) => p.transactionId === transactionId) ?? null;
  },

  // Fetches the authoritative record from the backend and refreshes the
  // local cache -- use this over getForTransaction when the caller needs
  // to know the real current status rather than whatever was last synced.
  async fetchForTransaction(transactionId: string): Promise<Payment | null> {
    const raw = await apiFetch<unknown | null>(`/api/transactions/${transactionId}/payment`);
    if (!raw) return null;
    const payment = normalizePayment(raw);
    saveLocal(payment);
    return payment;
  },

  getAll(): Payment[] {
    return storageService.get<Payment[]>(STORE_KEYS.PAYMENTS) ?? [];
  },

  getById(id: string): Payment | null {
    return this.getAll().find((p) => p.id === id) ?? null;
  },
};
