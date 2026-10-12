import { DomainError, type OrderStatus } from '../types.ts';
// Every valid transition. Anything not listed is rejected with 409 (see docs/ORDER_STATE_MACHINE.md).
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['PAID', 'ACCEPTED', 'CANCELLED', 'EXPIRED'],
  PAID: ['ACCEPTED', 'CANCELLED', 'REFUND_PENDING'],
  ACCEPTED: ['SCHEDULED', 'CANCELLED', 'FAILED'],
  SCHEDULED: ['COOKING', 'CANCELLED', 'FAILED'],
  COOKING: ['ASSEMBLY', 'CANCELLED', 'FAILED'],
  ASSEMBLY: ['EXPO_CHECK', 'COOKING', 'CANCELLED', 'FAILED'],
  EXPO_CHECK: ['READY', 'COOKING', 'CANCELLED', 'FAILED'],
  READY: ['HANDED_OVER', 'EXPO_CHECK', 'NO_SHOW'],
  HANDED_OVER: ['COMPLETED'],
  COMPLETED: [], CANCELLED: ['REFUND_PENDING'], EXPIRED: ['REFUND_PENDING'], NO_SHOW: ['REFUND_PENDING'], FAILED: ['REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED'], REFUNDED: [],
};
export const TERMINAL: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'FAILED', 'REFUNDED', 'REFUND_PENDING'];
export const ACTIVE: OrderStatus[] = ['PLACED', 'PAID', 'ACCEPTED', 'SCHEDULED', 'COOKING', 'ASSEMBLY', 'EXPO_CHECK', 'READY', 'HANDED_OVER'];
export function canTransition(from: OrderStatus, to: OrderStatus) { return TRANSITIONS[from].includes(to); }
export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) throw new DomainError('INVALID_TRANSITION', `Cannot move order from ${from} to ${to}`, 409, { from, to });
}
