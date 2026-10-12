import { DomainError } from '@queuebite/core';
export type Role = 'cook' | 'expo' | 'cashier' | 'waiter' | 'manager';
/** Role -> allowed capabilities. The manager role includes everything (owner uses it too). */
export const CAN: Record<string, Role[]> = {
  'kds.read': ['cook', 'expo', 'manager'], 'expo.read': ['expo', 'cashier', 'waiter', 'manager'], 'task.write': ['cook', 'manager'], 'expo.write': ['expo', 'cashier', 'waiter', 'manager'],
  'order.create.staff': ['cashier', 'waiter', 'manager'], 'order.accept': ['cashier', 'waiter', 'manager'], 'order.handover': ['expo', 'cashier', 'waiter', 'manager'],
  'order.cancel.staff': ['cashier', 'manager'], 'order.cancel.cooking': ['manager'], 'order.read.all': ['cashier', 'waiter', 'expo', 'cook', 'manager'],
  'inventory.read': ['cook', 'expo', 'cashier', 'manager'], 'inventory.write': ['manager'], 'admin': ['manager'], 'resource.write': ['cook', 'manager'],
};
export function pinsFromEnv(env: Record<string, string | undefined>): Record<string, Role> {
  const d: Record<string, Role> = { '1111': 'cook', '2222': 'expo', '3333': 'cashier', '4444': 'waiter', '9999': 'manager' }; // DEMO ONLY – set STAFF_PINS in production
  if (!env.STAFF_PINS) return d; const out: Record<string, Role> = {};
  for (const p of env.STAFF_PINS.split(',')) { const [pin, role] = p.split(':'); if (pin && role) out[pin] = role as Role; } return out;
}
export function requireRole(req: Request, pins: Record<string, Role>, cap: keyof typeof CAN): Role {
  // the query-string pin exists only for EventSource, which cannot send headers
  const pin = req.headers.get('x-staff-pin') ?? new URL(req.url).searchParams.get('pin') ?? '';
  const role = pins[pin];
  if (!role) throw new DomainError('UNAUTHENTICATED', 'Staff PIN required', 401);
  if (!CAN[cap].includes(role)) throw new DomainError('FORBIDDEN', `Role ${role} cannot do ${cap}`, 403);
  return role;
}
export async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)); return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private max: number; private windowMs: number; private now: () => number;
  constructor(max: number, windowMs: number, now: () => number = Date.now) { this.max = max; this.windowMs = windowMs; this.now = now; }
  check(key: string) { const t = this.now(); const a = (this.hits.get(key) ?? []).filter(x => t - x < this.windowMs); if (a.length >= this.max) { this.hits.set(key, a); throw new DomainError('RATE_LIMITED', 'Too many requests, slow down', 429); } a.push(t); this.hits.set(key, a); }
}
