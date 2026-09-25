// Converts backend JSON (decimal fields as strings, snake_case-free but
// missing `history` on list responses, `{ token, user }` auth shape) into
// the exact types the rest of the app expects from src/types/index.ts.

import type {
  AuthSession, User, UserRole, SupplyListing, DemandRequest, Transaction, TransactionEvent,
} from '../types';

function num(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface ApiUserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationName?: string | null;
  phone?: string | null;
  location?: string | null;
  verified: boolean;
  profileComplete: boolean;
  createdAt: string;
}

export interface ApiAuthResponse {
  token: string;
  user: ApiUserPublic;
}

export function mapUserPublic(raw: ApiUserPublic): Omit<User, 'passwordHash'> {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    organizationName: raw.organizationName ?? undefined,
    phone: raw.phone ?? undefined,
    location: raw.location ?? undefined,
    verified: raw.verified,
    profileComplete: raw.profileComplete,
    createdAt: raw.createdAt,
  };
}

export function sessionFromUser(user: ApiUserPublic): AuthSession {
  return { userId: user.id, role: user.role, name: user.name, email: user.email };
}

export function mapAuthResponse(resp: ApiAuthResponse): { session: AuthSession; token: string } {
  return { session: sessionFromUser(resp.user), token: resp.token };
}

// ─── Supply Listing ──────────────────────────────────────────────────────────

export interface ApiSupplyListing extends Omit<SupplyListing, 'quantity' | 'pricePerUnit'> {
  quantity: string | number;
  pricePerUnit: string | number;
}

export function mapListing(raw: ApiSupplyListing): SupplyListing {
  return { ...raw, quantity: num(raw.quantity), pricePerUnit: num(raw.pricePerUnit) };
}

// ─── Demand Request ──────────────────────────────────────────────────────────

export interface ApiDemandRequest extends Omit<DemandRequest, 'quantity' | 'indicativeBudget'> {
  quantity: string | number;
  indicativeBudget: string | number;
}

export function mapDemand(raw: ApiDemandRequest): DemandRequest {
  return { ...raw, quantity: num(raw.quantity), indicativeBudget: num(raw.indicativeBudget) };
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface ApiTransactionEvent {
  id: string;
  transactionId: string;
  status: TransactionEvent['status'];
  actor: string;
  actorRole: string;
  note?: string | null;
  createdAt: string;
}

function mapEvent(raw: ApiTransactionEvent): TransactionEvent {
  return {
    status: raw.status,
    timestamp: raw.createdAt,
    actor: raw.actor,
    actorRole: raw.actorRole as TransactionEvent['actorRole'],
    note: raw.note ?? undefined,
  };
}

export interface ApiTransaction
  extends Omit<Transaction, 'quantity' | 'pricePerUnit' | 'totalAmount' | 'history' | 'demandId' | 'paymentId' | 'logisticsJobId' | 'disputeId'> {
  quantity: string | number;
  pricePerUnit: string | number;
  totalAmount: string | number;
  demandId?: string | null;
  paymentId?: string | null;
  logisticsJobId?: string | null;
  disputeId?: string | null;
  history?: ApiTransactionEvent[];
}

export function mapTransaction(raw: ApiTransaction): Transaction {
  return {
    ...raw,
    quantity: num(raw.quantity),
    pricePerUnit: num(raw.pricePerUnit),
    totalAmount: num(raw.totalAmount),
    demandId: raw.demandId ?? undefined,
    paymentId: raw.paymentId ?? undefined,
    logisticsJobId: raw.logisticsJobId ?? undefined,
    disputeId: raw.disputeId ?? undefined,
    history: (raw.history ?? []).map(mapEvent),
  };
}

// ─── Logistics Job ───────────────────────────────────────────────────────────

export interface ApiLogisticsJob {
  id: string;
  transactionId?: string;
  transaction_id?: string;
  providerId?: string | null;
  provider_id?: string | null;
  providerName?: string | null;
  provider_name?: string | null;
  commodity: import('../types').CommodityType;
  quantity: string | number;
  unit: string;
  pickupLocation?: string;
  pickup_location?: string;
  deliveryLocation?: string;
  delivery_location?: string;
  pickupDate?: string;
  pickup_date?: string;
  expectedDeliveryDate?: string;
  expected_delivery_date?: string;
  logisticsCost?: string | number;
  logistics_cost?: string | number;
  currency: string;
  status: import('../types').LogisticsStatus;
  proofOfDelivery?: import('../types').ProofOfDelivery | null;
  proof_of_delivery?: import('../types').ProofOfDelivery | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export function mapLogisticsJob(raw: any): import('../types').LogisticsJob {
  return {
    id: raw.id,
    transactionId: raw.transactionId || raw.transaction_id,
    providerId: raw.providerId || raw.provider_id || undefined,
    providerName: raw.providerName || raw.provider_name || undefined,
    commodity: raw.commodity,
    quantity: num(raw.quantity),
    unit: raw.unit || 'tonnes',
    pickupLocation: raw.pickupLocation || raw.pickup_location || '',
    deliveryLocation: raw.deliveryLocation || raw.delivery_location || '',
    pickupDate: raw.pickupDate || raw.pickup_date || new Date().toISOString(),
    expectedDeliveryDate: raw.expectedDeliveryDate || raw.expected_delivery_date || new Date().toISOString(),
    logisticsCost: num(raw.logisticsCost ?? raw.logistics_cost ?? 0),
    currency: raw.currency || 'NGN',
    status: raw.status,
    proofOfDelivery: raw.proofOfDelivery || raw.proof_of_delivery || undefined,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
  };
}

