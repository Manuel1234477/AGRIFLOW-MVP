// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'buyer' | 'supplier' | 'logistics' | 'admin';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  organizationName?: string;
  phone?: string;
  location?: string;
  verified: boolean;
  profileComplete: boolean;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
}

// ─── Commodities ─────────────────────────────────────────────────────────────

export type CommodityType =
  | 'maize' | 'rice' | 'soybean' | 'sorghum' | 'beans' | 'yam'
  | 'wheat' | 'cassava' | 'millet' | 'groundnut';

export type QualityGrade = 'A' | 'B' | 'C' | 'standard' | 'premium';

export interface Commodity {
  type: CommodityType;
  label: string;
  icon: string;
  unit: 'tonnes' | 'kg' | 'bags';
}

// ─── Supply Listing Media & Inspection ───────────────────────────────────────

export interface ListingMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  size?: number;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt?: string;
}

export interface InspectionDetails {
  moistureContent?: string;
  packagingType?: string;
  harvestDate?: string;
  storageType?: string;
  certifications?: string[];
  batchNumber?: string;
}

export type ListingStatus = 'active' | 'inactive' | 'sold' | 'pending_review';

export interface SupplyListing {
  id: string;
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
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Demand Request ───────────────────────────────────────────────────────────

export type DemandStatus = 'open' | 'matched' | 'fulfilled' | 'closed';

export interface DemandRequest {
  id: string;
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
  status: DemandStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Match ────────────────────────────────────────────────────────────────────

export interface MatchFactor {
  label: string;
  matched: boolean;
  detail?: string;
}

export interface Match {
  id: string;
  demandId: string;
  listingId: string;
  buyerId: string;
  supplierId: string;
  score: number;
  factors: MatchFactor[];
  createdAt: string;
}

// ─── Transaction State Machine ────────────────────────────────────────────────

export type TransactionStatus =
  | 'PENDING'
  | 'PENDING_SUPPLIER_ACCEPTANCE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'LOGISTICS_PENDING'
  | 'LOGISTICS_ASSIGNED'
  | 'LOGISTICS_ACCEPTED'
  | 'LOGISTICS_REJECTED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'BUYER_CONFIRMATION_PENDING'
  | 'DELIVERY_CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'DELIVERY_FAILED';

export interface TransactionEvent {
  status: TransactionStatus;
  timestamp: string;
  actor: string;
  actorRole: UserRole | 'system';
  note?: string;
}

export interface Transaction {
  id: string;
  listingId: string;
  demandId?: string;
  buyerId: string;
  buyerName: string;
  supplierId: string;
  supplierName: string;
  commodity: CommodityType;
  quantity: number;
  unit: string;
  qualityGrade: QualityGrade;
  pricePerUnit: number;
  totalAmount: number;
  currency: string;
  pickupLocation: string;
  deliveryLocation: string;
  expectedDeliveryDate: string;
  status: TransactionStatus;
  history: TransactionEvent[];
  paymentId?: string;
  logisticsJobId?: string;
  disputeId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface Payment {
  id: string;
  transactionId: string;
  payerId: string;
  amount: number;
  currency: string;
  provider: string;
  providerReference?: string;
  paymentMethod?: 'bachs' | 'crypto' | 'bank' | 'card' | 'other';
  bachsCheckoutSessionId?: string;
  bachsCheckoutUrl?: string;
  bachsPaymentStatus?: string;
  status: PaymentStatus;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─── Logistics ────────────────────────────────────────────────────────────────

export type LogisticsStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'FAILED';

export interface ProofOfDelivery {
  recipientName: string;
  deliveryNote: string;
  timestamp: string;
  recordedBy: string;
}

export interface LogisticsJob {
  id: string;
  transactionId: string;
  commodity: CommodityType;
  quantity: number;
  unit: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupDate: string;
  expectedDeliveryDate: string;
  logisticsCost: number;
  currency: string;
  providerId?: string;
  providerName?: string;
  status: LogisticsStatus;
  proofOfDelivery?: ProofOfDelivery;
  createdAt: string;
  updatedAt: string;
}

// ─── Dispute ──────────────────────────────────────────────────────────────────

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';

export interface Dispute {
  id: string;
  transactionId: string;
  raisedById: string;
  raisedByName: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedById?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'transaction_request'
  | 'transaction_accepted'
  | 'transaction_rejected'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'logistics_assigned'
  | 'logistics_accepted'
  | 'shipment_update'
  | 'delivery_received'
  | 'delivery_confirmed'
  | 'transaction_completed'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'general';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  transactionId?: string;
  read: boolean;
  createdAt: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'user_registered'
  | 'supply_created'
  | 'supply_updated'
  | 'demand_created'
  | 'match_generated'
  | 'transaction_initiated'
  | 'transaction_accepted'
  | 'transaction_rejected'
  | 'payment_initiated'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'logistics_job_created'
  | 'logistics_provider_assigned'
  | 'logistics_job_accepted'
  | 'logistics_job_rejected'
  | 'shipment_ready'
  | 'shipment_picked_up'
  | 'shipment_in_transit'
  | 'shipment_delivered'
  | 'delivery_confirmed'
  | 'transaction_completed'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'withdrawal_requested'
  | 'withdrawal_processed'
  | 'data_reset';

export interface AuditEvent {
  id: string;
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorRole: UserRole | 'system';
  entityId?: string;
  entityType?: string;
  detail?: string;
  transactionId?: string;
  createdAt: string;
}
