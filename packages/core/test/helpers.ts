import { Engine, MIN, type CreateOrderInput, type Policy } from '@queuebite/core';
export class Clk { t: number; constructor(t = Date.UTC(2026, 9, 10, 7, 30)) { this.t = t; } now() { return this.t; } adv(min: number) { this.t += min * MIN; } }
export const cust = (n = 'Asha') => ({ name: n, phone: '9876543210' });
export function mk(policy: Policy = 'smart') { const clock = new Clk(); const e = new Engine({ clock, policy }); return { clock, e }; }
export const walkin = (items: [string, number][], over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({ channel: 'COUNTER', mode: 'TAKEAWAY', customer: cust(), items: items.map(([menuItemId, qty]) => ({ menuItemId, qty })), ...over });
export const pre = (items: [string, number][], over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({ channel: 'WEB', mode: 'PREORDER', customer: cust(), distanceKm: 1, slotInMin: 15, items: items.map(([menuItemId, qty]) => ({ menuItemId, qty })), ...over });
/** run kitchen obediently until every active order is READY */
export function cookAll(e: Engine, clock: Clk, maxMin = 60) {
  for (let i = 0; i < maxMin * 12; i++) {
    e.tick();
    for (const t of e.tasks.values()) if (t.status === 'RELEASED') { try { e.startTask(t.id); } catch { /* batch mate */ } }
    for (const t of e.tasks.values()) if (t.status === 'COOKING' && clock.now() >= t.actualStart! + e.menu.get(t.itemId)!.cookMin * MIN) e.doneTask(t.id);
    for (const o of e.orders.values()) if (o.status === 'ASSEMBLY') e.markReady(o.id, o.items.map(x => x.id));
    if ([...e.orders.values()].every(o => ['READY', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'HANDED_OVER'].includes(o.status))) return;
    clock.t += 5000;
  }
}
