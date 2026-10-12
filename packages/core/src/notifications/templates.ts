import type { Order } from '../types.ts';
export type NotifyEvent = 'ORDER_ACCEPTED' | 'ORDER_PREPARING' | 'ORDER_READY' | 'DELAY_DETECTED';
export const ANIMATION: Record<NotifyEvent, string> = { ORDER_ACCEPTED: 'accepted', ORDER_PREPARING: 'preparing', ORDER_READY: 'ready', DELAY_DETECTED: 'delay' };
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
/** WhatsApp needs approved templates; keep wording short and token-first. The SMS version carries the tracking link. */
export function render(ev: NotifyEvent, o: Order, range: { lo: number; hi: number }, link: string, channel: 'WHATSAPP' | 'SMS'): string {
  const tail = channel === 'SMS' ? ` ${link}` : `\nTrack: ${link}`;
  switch (ev) {
    case 'ORDER_ACCEPTED': return `Order confirmed. Token ${o.token}. Estimated ready: ${range.lo}–${range.hi} min.${o.leaveAt ? ` Leave at ${hhmm(o.leaveAt)}.` : ''}${tail}`;
    case 'ORDER_PREPARING': return `We're cooking your order ${o.token}. Ready in ${range.lo}–${range.hi} min.${tail}`;
    case 'ORDER_READY': return `Your order ${o.token} is ready. ${o.mode === 'DINE_IN' ? 'We are bringing it to your table.' : 'Collect it at the pickup counter with your token.'}${tail}`;
    case 'DELAY_DETECTED': return `Sorry, ${o.token} needs a little longer: now ${range.lo}–${range.hi} min.${tail}`;
  }
}
