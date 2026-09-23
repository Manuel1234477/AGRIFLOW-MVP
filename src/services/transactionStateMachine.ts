import type { TransactionStatus, UserRole } from '../types';

// Valid state transitions map
const TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  PENDING: ['PENDING_SUPPLIER_ACCEPTANCE', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
  PENDING_SUPPLIER_ACCEPTANCE: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PAYMENT_PENDING', 'CANCELLED'],
  REJECTED: [],
  PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED'],
  PAYMENT_CONFIRMED: ['LOGISTICS_PENDING', 'LOGISTICS_ASSIGNED', 'LOGISTICS_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_CANCELLED: ['CANCELLED'],
  LOGISTICS_PENDING: ['LOGISTICS_ASSIGNED', 'LOGISTICS_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  LOGISTICS_ASSIGNED: ['LOGISTICS_ACCEPTED', 'LOGISTICS_REJECTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  LOGISTICS_ACCEPTED: ['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  LOGISTICS_REJECTED: ['LOGISTICS_PENDING'],
  READY_FOR_PICKUP: ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  PICKED_UP: ['IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  IN_TRANSIT: ['DELIVERED', 'BUYER_CONFIRMATION_PENDING', 'DELIVERY_CONFIRMED', 'COMPLETED', 'DELIVERY_FAILED'],
  DELIVERED: ['BUYER_CONFIRMATION_PENDING', 'DELIVERY_CONFIRMED', 'COMPLETED', 'DISPUTED'],
  BUYER_CONFIRMATION_PENDING: ['DELIVERY_CONFIRMED', 'COMPLETED', 'DISPUTED'],
  DELIVERY_CONFIRMED: ['COMPLETED'],
  DELIVERY_FAILED: ['DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
};

// Which roles can trigger which transitions
const ALLOWED_ACTORS: Partial<Record<TransactionStatus, Array<UserRole | 'system'>>> = {
  PENDING_SUPPLIER_ACCEPTANCE: ['buyer', 'system'],
  ACCEPTED: ['supplier'],
  REJECTED: ['supplier'],
  PAYMENT_PENDING: ['buyer', 'system'],
  PAYMENT_CONFIRMED: ['buyer', 'system', 'admin'],
  PAYMENT_FAILED: ['buyer', 'system'],
  PAYMENT_CANCELLED: ['buyer', 'system'],
  LOGISTICS_PENDING: ['buyer', 'system', 'admin'],
  LOGISTICS_ASSIGNED: ['admin', 'system', 'logistics'],
  LOGISTICS_ACCEPTED: ['logistics', 'system', 'admin'],
  LOGISTICS_REJECTED: ['logistics', 'system', 'admin'],
  READY_FOR_PICKUP: ['logistics', 'system', 'admin'],
  PICKED_UP: ['logistics', 'system', 'admin'],
  IN_TRANSIT: ['logistics', 'system', 'admin'],
  DELIVERED: ['logistics', 'system', 'admin'],
  BUYER_CONFIRMATION_PENDING: ['logistics', 'system', 'admin'],
  DELIVERY_CONFIRMED: ['buyer', 'system', 'admin'],
  DELIVERY_FAILED: ['buyer', 'logistics', 'admin'],
  COMPLETED: ['buyer', 'system', 'admin', 'logistics', 'supplier'],
  CANCELLED: ['buyer', 'supplier', 'admin'],
  DISPUTED: ['buyer'],
};

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  if (from === to) return true;
  // Completing a transaction from any active in-transit / delivery / confirmed state is always allowed
  if (to === 'COMPLETED' && !['REJECTED', 'CANCELLED'].includes(from)) return true;
  // If already at or beyond ACCEPTED, supplier accepting is idempotent
  if (to === 'ACCEPTED' && (from === 'PAYMENT_PENDING' || from === 'PAYMENT_CONFIRMED')) return true;
  // If already completed or confirmed, confirming delivery / completing is idempotent
  if ((from === 'COMPLETED' || from === 'DELIVERY_CONFIRMED') && (to === 'DELIVERY_CONFIRMED' || to === 'COMPLETED')) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function canActorTransition(
  from: TransactionStatus,
  to: TransactionStatus,
  actorRole: UserRole | 'system'
): { allowed: boolean; reason?: string } {
  if (from === to) return { allowed: true };
  if (!canTransition(from, to)) {
    return { allowed: false, reason: `Transition from ${from} to ${to} is not permitted.` };
  }
  const allowed = ALLOWED_ACTORS[to];
  if (allowed && !allowed.includes(actorRole)) {
    return { allowed: false, reason: `A ${actorRole} cannot perform this action.` };
  }
  return { allowed: true };
}

export function getNextActions(
  currentStatus: TransactionStatus,
  actorRole: UserRole | 'system'
): TransactionStatus[] {
  const transitions = TRANSITIONS[currentStatus] ?? [];
  return transitions.filter((to) => {
    const allowed = ALLOWED_ACTORS[to];
    return !allowed || allowed.includes(actorRole);
  });
}

export function getStatusLabel(status: TransactionStatus): string {
  const labels: Record<TransactionStatus, string> = {
    PENDING: 'Pending',
    PENDING_SUPPLIER_ACCEPTANCE: 'Pending Acceptance',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    PAYMENT_PENDING: 'Payment Pending',
    PAYMENT_CONFIRMED: 'Payment Confirmed',
    PAYMENT_FAILED: 'Payment Failed',
    PAYMENT_CANCELLED: 'Payment Cancelled',
    LOGISTICS_PENDING: 'Logistics Pending',
    LOGISTICS_ASSIGNED: 'Logistics Assigned',
    LOGISTICS_ACCEPTED: 'Logistics Accepted',
    LOGISTICS_REJECTED: 'Logistics Rejected',
    READY_FOR_PICKUP: 'Ready for Pickup',
    PICKED_UP: 'Picked Up',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered',
    BUYER_CONFIRMATION_PENDING: 'Awaiting Confirmation',
    DELIVERY_CONFIRMED: 'Delivery Confirmed',
    DELIVERY_FAILED: 'Delivery Failed',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    DISPUTED: 'Disputed',
  };
  return labels[status] ?? status;
}

export function getStatusColor(status: TransactionStatus): string {
  const map: Record<TransactionStatus, string> = {
    PENDING: 'bg-gray-100 text-gray-800 border-gray-200',
    PENDING_SUPPLIER_ACCEPTANCE: 'bg-gray-100 text-gray-800 border-gray-200',
    ACCEPTED: 'bg-blue-100 text-blue-800 border-blue-200',
    REJECTED: 'bg-red-100 text-red-800 border-red-200',
    PAYMENT_PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    PAYMENT_CONFIRMED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PAYMENT_FAILED: 'bg-red-100 text-red-800 border-red-200',
    PAYMENT_CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
    LOGISTICS_PENDING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    LOGISTICS_ASSIGNED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    LOGISTICS_ACCEPTED: 'bg-blue-100 text-blue-800 border-blue-200',
    LOGISTICS_REJECTED: 'bg-red-100 text-red-800 border-red-200',
    READY_FOR_PICKUP: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    PICKED_UP: 'bg-sky-100 text-sky-800 border-sky-200',
    IN_TRANSIT: 'bg-violet-100 text-violet-800 border-violet-200',
    DELIVERED: 'bg-purple-100 text-purple-800 border-purple-200',
    BUYER_CONFIRMATION_PENDING: 'bg-purple-100 text-purple-800 border-purple-200',
    DELIVERY_CONFIRMED: 'bg-green-100 text-green-800 border-green-200',
    DELIVERY_FAILED: 'bg-red-100 text-red-800 border-red-200',
    COMPLETED: 'bg-green-100 text-green-800 border-green-200',
    CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
    DISPUTED: 'bg-red-100 text-red-800 border-red-200',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800 border-gray-200';
}

export const TRANSACTION_PIPELINE: TransactionStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PAYMENT_CONFIRMED',
  'LOGISTICS_ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
];

export function getPipelineIndex(status: TransactionStatus): number {
  switch (status) {
    case 'PENDING':
    case 'PENDING_SUPPLIER_ACCEPTANCE':
      return 0;
    case 'ACCEPTED':
      return 1;
    case 'PAYMENT_PENDING':
      return 2;
    case 'PAYMENT_CONFIRMED':
    case 'LOGISTICS_PENDING':
    case 'LOGISTICS_ASSIGNED':
    case 'LOGISTICS_ACCEPTED':
    case 'READY_FOR_PICKUP':
      return 3;
    case 'PICKED_UP':
    case 'IN_TRANSIT':
      return 4;
    case 'DELIVERED':
    case 'BUYER_CONFIRMATION_PENDING':
    case 'DELIVERY_CONFIRMED':
      return 5;
    case 'COMPLETED':
      return 6;
    default:
      return -1;
  }
}
