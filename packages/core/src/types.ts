// Domain types. Time values are epoch milliseconds; durations in config are minutes.
export const MIN = 60_000;
export type Mode = 'PREORDER' | 'DINE_IN' | 'TAKEAWAY';
export type Channel = 'WHATSAPP' | 'CHATBOT' | 'APP' | 'WEB' | 'QR' | 'COUNTER';
export type PaymentMode = 'PREPAID' | 'COUNTER' | 'TABLE_BILL';
export type StationId = 'grill' | 'fryer' | 'wok' | 'bev' | 'cold' | 'pack';

export type OrderStatus =
  | 'PLACED' | 'PAID' | 'ACCEPTED' | 'SCHEDULED' | 'COOKING' | 'ASSEMBLY' | 'EXPO_CHECK'
  | 'READY' | 'HANDED_OVER' | 'COMPLETED'
  | 'CANCELLED' | 'EXPIRED' | 'NO_SHOW' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';

export type TaskStatus = 'PLANNED' | 'READY' | 'RELEASED' | 'COOKING' | 'PAUSED' | 'DONE' | 'BLOCKED' | 'CANCELLED' | 'FAILED';

export interface RecipeLine { ingredient: string; qty: number; pack?: boolean /* consumed at pack time, not for dine-in */ }
export interface MenuItem {
  id: string; name: string; price: number; station: StationId;
  cookMin: number; batchCap: number; holdMin: number; emoji: string; recipe: RecipeLine[];
}
export interface StationDef { id: StationId; name: string; units: number }
export interface Ingredient { id: string; name: string; unit: string; onHand: number; reserved: number; reorderLevel: number }

export interface OrderItem { id: string; menuItemId: string; name: string; qty: number; price: number }
export interface Quote { p50: number; p80: number; p90: number; lo: number; hi: number } // lo/hi = minutes from creation (customer range)
export interface Order {
  id: string; token: string; channel: Channel; mode: Mode; status: OrderStatus; version: number;
  customer: { name: string; phone: string }; table?: string; distanceKm?: number;
  items: OrderItem[]; total: number; paymentMode: PaymentMode; paid: boolean;
  createdAt: number; holdExpiresAt?: number; acceptedAt?: number;
  slotAt?: number;            // pre-order pickup slot (deadline)
  deadline: number;           // ms; promised ready used for slack
  promisedP50?: number; promisedP80?: number; promisedP90?: number;
  plannedReadyAt?: number; readyAt?: number; readyNotifyAt?: number; handedOverAt?: number;
  arrived: boolean; leaving: boolean; leaveAt?: number;
  idempotencyKey?: string; businessDay: string;
  cancelReason?: string; refund: 'NONE' | 'REFUND_PENDING' | 'REFUNDED'; refundAmount: number;
  delayNotices: number; accessKey: string; // unguessable key the customer link carries
}
export interface Task {
  id: string; orderId: string; orderItemId: string; itemId: string; station: StationId;
  status: TaskStatus; unit?: number; batchId?: string;
  plannedStart?: number; plannedFinish?: number; actualStart?: number; actualFinish?: number;
  version: number; replacementOf?: string;
}
export interface OrderEvent { id: number; orderId: string; type: string; version: number; at: number; data?: Record<string, unknown> }
export type LedgerType = 'RESERVE' | 'RELEASE' | 'CONSUME' | 'WASTE' | 'RECEIPT' | 'ADJUST';
export interface LedgerEntry { id: number; at: number; ingredient: string; type: LedgerType; qty: number; ref?: string; note?: string }
export interface Notification { id: number; orderId: string; event: string; channel: 'WHATSAPP' | 'SMS' | 'PUSH'; status: 'SENT' | 'FAILED'; text: string; animation: string; at: number; dedupeKey: string }

export class DomainError extends Error {
  code: string; status: number; details: Record<string, unknown>;
  constructor(code: string, message: string, status = 422, details: Record<string, unknown> = {}) { super(message); this.code = code; this.status = status; this.details = details; }
}
export interface Clock { now(): number }
export type Policy = 'smart' | 'fifo' | 'deadline';
