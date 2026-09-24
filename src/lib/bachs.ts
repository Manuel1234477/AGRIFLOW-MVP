/**
 * Bachs.io Real Checkout API Client
 * Official Integration based on Bachs.io Payments specification:
 * https://docs.bachs.io/guides/checkout/checkout-sessions
 */

export interface BachsCustomerInfo {
  email: string;
  name: string;
  phoneNumber?: string;
}

export interface CreateCheckoutSessionParams {
  transactionId: string;
  amount: number | string;
  currency: 'NGN' | 'USD' | 'GHS' | 'KES';
  customer: BachsCustomerInfo;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface BachsCheckoutSession {
  id: string;
  url: string;
  status: 'open' | 'completed' | 'expired';
  amountTotal: string;
  currency: string;
  customer?: {
    email: string;
    name: string;
  };
  availablePaymentMethods?: string[];
  expiresAt?: string;
  createdAt?: string;
}

export const BACHS_CONFIG = {
  sandboxApiUrl: 'https://sandbox-api.bachs.io/v1/checkout-sessions',
  liveApiUrl: 'https://api.bachs.io/v1/checkout-sessions',
  secretKey:
    import.meta.env.VITE_BACHS_SECRET_KEY ||
    'sk_sandbox_26a417c6_wjB3o7PUihDiKg3ms3yUeaFRJl3ZORJQaoPYqMtdbdw',
  webhookUrl:
    import.meta.env.VITE_BACHS_WEBHOOK_URL ||
    'https://agri-flowmvp.vercel.app/api/webhooks/bachs',
  webhookSecret:
    import.meta.env.VITE_BACHS_WEBHOOK_SECRET ||
    'whsec_5cf64ff36a53cbb8e342b4e2bd204f63101c5800db9c1771ccba8adbd53265a3',
};

/**
 * Creates a real Bachs.io Checkout Session against the Bachs sandbox/live API
 */
export async function createBachsCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<BachsCheckoutSession> {
  const amountStr =
    typeof params.amount === 'number'
      ? params.amount.toFixed(2)
      : Number(params.amount).toFixed(2);

  const baseUrl = window.location.origin;
  const successUrl =
    params.successUrl ||
    `${baseUrl}/app/transactions/${params.transactionId}?payment=success`;
  const cancelUrl =
    params.cancelUrl ||
    `${baseUrl}/app/transactions/${params.transactionId}/pay?payment=cancelled`;

  const payload = {
    pricing: {
      amount: amountStr,
      currency: params.currency,
    },
    customer: {
      email: params.customer.email || 'buyer@agriflow.africa',
      name: params.customer.name || 'AgriFlow Buyer',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      transaction_id: params.transactionId,
      platform: 'AgriFlow',
      escrow: 'true',
      ...params.metadata,
    },
  };

  try {
    const response = await fetch(BACHS_CONFIG.sandboxApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BACHS_CONFIG.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.detail ||
          errData.message ||
          `Bachs API returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return {
      id: data.checkout_id,
      url: data.checkout_url,
      status: data.status || 'open',
      amountTotal: data.amount || amountStr,
      currency: data.currency || params.currency,
      availablePaymentMethods: data.available_payment_methods || [
        'NGN_BANK_TRANSFER',
        'NGN_CARD',
      ],
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    console.error('Bachs API checkout session error:', err);
    throw err;
  }
}
