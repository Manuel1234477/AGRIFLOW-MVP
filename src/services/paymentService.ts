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
    try {
      await apiFetch<any>(`/api/transactions/${params.transactionId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          to: 'PAYMENT_PENDING',
          note: 'Buyer initiated payment.',
        }),
      });
    } catch {
      // If already PAYMENT_PENDING or beyond, or transition endpoint rejected because it is already pending, proceed
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

  // Backed by POST /transactions/:id/payment/confirm. `onChainTxHash` is
  // optional and used for on-chain deposit confirmation.
  async confirm(paymentId: string, _actorId?: string, _actorName?: string, onChainTxHash?: string): Promise<Payment> {
    const existing = this.getById(paymentId);
    if (!existing) throw new Error('Payment not found.');

    const txnData = await apiFetch<any>(`/api/transactions/${existing.transactionId}/payment/confirm`, {
      method: 'POST',
      body: JSON.stringify(onChainTxHash ? { stellarTxHash: onChainTxHash } : {}),
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

  // Backed by POST /transactions/:id/payment/bachs/checkout-session.
  // Creates the Bachs hosted checkout session server-side -- the API
  // secret key never reaches the browser (unlike the old direct-to-Bachs
  // client this replaces, src/lib/bachs.ts). Requires initiate() to have
  // been called first, same as confirm()/fail().
  async createBachsCheckoutSession(transactionId: string): Promise<{ checkoutUrl: string }> {
    try {
      await apiFetch<any>(`/api/transactions/${transactionId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          to: 'PAYMENT_PENDING',
          note: 'Buyer initiated Bachs checkout session',
        }),
      });
    } catch {
      // Ignore if already in PAYMENT_PENDING
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const successUrl = origin ? `${origin}/app/transactions/${transactionId}?payment=success` : undefined;
    const cancelUrl = origin ? `${origin}/app/transactions/${transactionId}/pay?payment=cancelled` : undefined;
    return apiFetch<{ checkoutUrl: string }>(
      `/api/transactions/${transactionId}/payment/bachs/checkout-session`,
      { method: 'POST', body: JSON.stringify({ successUrl, cancelUrl }) },
    );
  },

  // Polls the backend until the payment reaches a terminal state
  // (CONFIRMED/FAILED) or the timeout elapses. Use this after returning
  // from a hosted checkout redirect instead of trusting the redirect's own
  // `?payment=success` query param -- that param carries no authority on
  // its own; only the backend's webhook-verified state does. A buyer could
  // navigate straight to the "success" URL without ever paying, so acting
  // on the param directly would reopen the exact hole the Bachs webhook
  // was built to close.
  async pollUntilSettled(
    transactionId: string,
    { intervalMs = 1500, timeoutMs = 60_000 }: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<Payment | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const payment = await this.fetchForTransaction(transactionId);
      if (payment && (payment.status === 'CONFIRMED' || payment.status === 'FAILED')) {
        return payment;
      }
      if (Date.now() >= deadline) {
        return payment;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
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
