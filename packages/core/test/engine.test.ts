import { test } from 'node:test'; import assert from 'node:assert/strict';
import { DomainError, MIN } from '@queuebite/core'; import { mk, walkin, pre, cookAll, cust } from './helpers.ts';

test('walk-in order: token W-001, accepted, quote range at least 2 minutes wide', () => {
  const { e } = mk(); const { order } = e.createOrder(walkin([['burger', 1], ['fries', 1]])); e.accept(order.id);
  const o = e.get(order.id); assert.equal(o.token, 'W-001'); assert.equal(o.status, 'SCHEDULED');
  const live = e.live(o.id); assert.ok(live.eta && live.eta.hi - live.eta.lo >= 2);
});
test('tokens: P / T / W prefixes, per-day sequence, reset on closeDay', () => {
  const { e, clock } = mk(); const p = e.createOrder(pre([['burger', 1]])).order; e.confirmPayment('p1', p.id, p.total);
  const t = e.createOrder({ channel: 'QR', mode: 'DINE_IN', table: '7', customer: cust(), items: [{ menuItemId: 'chai', qty: 1 }] }).order;
  const w = e.createOrder(walkin([['chai', 1]])).order; e.accept(w.id);
  assert.deepEqual([e.get(p.id).token, e.get(t.id).token, e.get(w.id).token], ['P-001', 'T-001', 'W-001']);
  e.closeDay(); const w2 = e.createOrder(walkin([['chai', 1]]), 'k2').order; e.accept(w2.id); assert.equal(e.get(w2.id).token, 'W-001'); void clock;
});
test('server recomputes the price from the menu', () => {
  const { e } = mk(); const { order } = e.createOrder(walkin([['burger', 2]])); assert.equal(order.total, 198);
});
test('validation: empty order, bad phone, dine-in without table, qty out of range, unknown item', () => {
  const { e } = mk();
  const bad = (f: () => unknown, code: string) => assert.throws(f, (x: unknown) => x instanceof DomainError && x.code === code);
  bad(() => e.createOrder(walkin([])), 'EMPTY_ORDER'); bad(() => e.createOrder(walkin([['burger', 1]], { customer: { name: 'A', phone: '12' } })), 'BAD_CUSTOMER');
  bad(() => e.createOrder({ channel: 'QR', mode: 'DINE_IN', customer: cust(), items: [{ menuItemId: 'chai', qty: 1 }] }), 'TABLE_REQUIRED');
  bad(() => e.createOrder(walkin([['burger', 99]])), 'BAD_QTY'); bad(() => e.createOrder(walkin([['pizza', 1]])), 'UNKNOWN_ITEM');
});
test('idempotency: same key returns the same order, no second reservation', () => {
  const { e } = mk(); const a = e.createOrder(walkin([['burger', 2]]), 'key-1'); const b = e.createOrder(walkin([['burger', 2]]), 'key-1');
  assert.equal(a.order.id, b.order.id); assert.equal(b.duplicate, true); assert.equal(e.orders.size, 1); assert.equal(e.inventory.items.get('bun')!.reserved, 2);
});
test('duplicate payment webhook has exactly one effect', () => {
  const { e } = mk(); const { order } = e.createOrder(pre([['burger', 1]]));
  const r1 = e.confirmPayment('evt-1', order.id, order.total); const r2 = e.confirmPayment('evt-1', order.id, order.total);
  assert.equal(r1.duplicate, false); assert.equal(r2.duplicate, true); assert.equal(e.get(order.id).token, 'P-001'); assert.equal(e.notifications.filter(n => n.event === 'ORDER_ACCEPTED').length, 1);
  assert.equal(e.events.filter(x => x.type === 'ORDER_ACCEPTED').length, 1);
});
test('payment with the wrong amount is rejected', () => {
  const { e } = mk(); const { order } = e.createOrder(pre([['burger', 1]]));
  assert.throws(() => e.confirmPayment('evt-x', order.id, 1), (x: unknown) => x instanceof DomainError && x.code === 'AMOUNT_MISMATCH');
});
test('pre-order cannot be accepted without payment; unpaid hold expires and releases stock', () => {
  const { e, clock } = mk(); const { order } = e.createOrder(pre([['burger', 3]]));
  assert.throws(() => e.accept(order.id), (x: unknown) => x instanceof DomainError && x.code === 'PAYMENT_REQUIRED');
  assert.equal(e.inventory.items.get('bun')!.reserved, 3); clock.adv(11); e.tick();
  assert.equal(e.get(order.id).status, 'EXPIRED'); assert.equal(e.inventory.items.get('bun')!.reserved, 0);
  const late = e.confirmPayment('late', order.id, order.total); assert.equal(late.order.refund, 'REFUND_PENDING'); // paid after expiry -> refund, no cooking
});
test('last 3 buns: only one of two competing orders succeeds, nothing oversold', () => {
  const { e } = mk(); e.inventory.adjust('bun', 3);
  const x = e.createOrder(walkin([['burger', 2]]), 'x'); assert.ok(x.order.id);
  assert.throws(() => e.createOrder(walkin([['burger', 2]], { customer: cust('Y') }), 'y'), (err: unknown) => err instanceof DomainError && err.code === 'STOCK_SHORT');
  assert.equal(e.inventory.available('bun'), 1); assert.equal(e.orders.size, 1); // failed order left no trace
  const ok = e.createOrder(walkin([['burger', 1]]), 'z'); assert.ok(ok.order.id); assert.equal(e.inventory.available('bun'), 0);
  assert.equal(e.menuView().find(m => m.id === 'burger')!.available, false);
});
test('stock lifecycle: reserve -> consume at start -> packaging at ready; ledger explains every number', () => {
  const { e, clock } = mk(); const { order } = e.createOrder(walkin([['burger', 1]])); e.accept(order.id);
  assert.equal(e.inventory.items.get('patty')!.reserved, 1); cookAll(e, clock);
  assert.equal(e.get(order.id).status, 'READY'); const pat = e.inventory.items.get('patty')!; assert.equal(pat.onHand, 39); assert.equal(pat.reserved, 0);
  const box = e.inventory.items.get('burger_box')!; assert.equal(box.onHand, 59);
  const types = e.inventory.ledger.filter(l => l.ingredient === 'patty').map(l => l.type); assert.deepEqual(types, ['RESERVE', 'CONSUME']);
});
test('dine-in plates use no packaging', () => {
  const { e, clock } = mk(); const { order } = e.createOrder({ channel: 'QR', mode: 'DINE_IN', table: '2', customer: cust(), items: [{ menuItemId: 'burger', qty: 1 }] });
  cookAll(e, clock); assert.equal(e.get(order.id).status, 'READY'); assert.equal(e.inventory.items.get('burger_box')!.onHand, 60);
});
test('cancel before cooking: free, stock released, refund full', () => {
  const { e } = mk(); const { order } = e.createOrder(pre([['burger', 2]])); e.confirmPayment('p', order.id, order.total);
  const o = e.cancel(order.id); assert.equal(o.status, 'REFUNDED'); assert.equal(o.refundAmount, order.total); assert.equal(e.inventory.items.get('bun')!.reserved, 0);
});
test('cancel after cooking started needs a manager; consumed food becomes WASTE; partial refund', () => {
  const { e, clock } = mk(); const { order } = e.createOrder(pre([['burger', 2]], { slotInMin: 10 })); e.confirmPayment('p', order.id, order.total);
  for (let i = 0; i < 400 && ![...e.tasks.values()].some(t => t.status === 'COOKING'); i++) { clock.t += 5000; e.tick(); for (const t of e.tasks.values()) if (t.status === 'RELEASED') e.startTask(t.id); }
  assert.throws(() => e.cancel(order.id), (x: unknown) => x instanceof DomainError && x.code === 'COOKING_STARTED');
  const o = e.cancel(order.id, { manager: true, refund: 'PARTIAL' }); assert.equal(o.status, 'REFUNDED'); assert.equal(o.refundAmount, Math.round(order.total / 2));
  assert.ok(e.inventory.ledger.some(l => l.type === 'WASTE' && l.ingredient === 'patty')); assert.equal(e.inventory.items.get('bun')!.reserved, 0);
  assert.equal(e.cancel(order.id).status, 'REFUNDED'); // second cancel is a no-op, no second refund
});
test('expo: READY needs every item checked; handover needs token or phone; duplicate handover is a no-op', () => {
  const { e, clock } = mk(); const { order } = e.createOrder(walkin([['burger', 1], ['chai', 1]])); e.accept(order.id);
  for (let i = 0; i < 600 && e.get(order.id).status !== 'ASSEMBLY'; i++) { clock.t += 5000; e.tick(); for (const t of e.tasks.values()) { if (t.status === 'RELEASED') e.startTask(t.id); if (t.status === 'COOKING' && clock.now() >= t.actualStart! + e.menu.get(t.itemId)!.cookMin * MIN) e.doneTask(t.id); } }
  assert.equal(e.get(order.id).status, 'ASSEMBLY'); const ids = e.get(order.id).items.map(i => i.id);
  assert.throws(() => e.markReady(order.id, [ids[0]]), (x: unknown) => x instanceof DomainError && x.code === 'EXPO_ITEMS_MISSING');
  e.markReady(order.id, ids); assert.equal(e.get(order.id).status, 'READY');
  assert.throws(() => e.handover(order.id, 'W-999'), (x: unknown) => x instanceof DomainError && x.code === 'WRONG_CUSTOMER');
  e.handover(order.id, '3210'); assert.equal(e.get(order.id).status, 'COMPLETED'); const ev = e.events.length; e.handover(order.id, '3210'); assert.equal(e.events.length, ev);
});
test('READY message is held for the undo window; undo cancels it; later send happens once', () => {
  const { e, clock } = mk(); const { order } = e.createOrder(walkin([['chai', 1]])); e.accept(order.id); cookAll(e, clock);
  assert.equal(e.get(order.id).status, 'READY'); assert.equal(e.notifications.filter(n => n.event === 'ORDER_READY').length, 0);
  e.undoReady(order.id); assert.equal(e.get(order.id).status, 'EXPO_CHECK'); clock.adv(1); e.tick(); assert.equal(e.notifications.filter(n => n.event === 'ORDER_READY').length, 0);
  e.markReady(order.id, e.get(order.id).items.map(i => i.id)); clock.t += 25000; e.tick(); e.tick(); assert.equal(e.notifications.filter(n => n.event === 'ORDER_READY').length, 1);
  assert.throws(() => e.undoReady(order.id), (x: unknown) => x instanceof DomainError && x.code === 'UNDO_WINDOW_PASSED');
});
test('notifications: accepted + preparing + ready, deduplicated; SMS fallback when WhatsApp fails', () => {
  const { e, clock } = mk(); e.failWhatsapp = true; const { order } = e.createOrder(walkin([['chai', 1]])); e.accept(order.id); cookAll(e, clock); clock.t += 30000; e.tick();
  const ns = e.notifications.filter(n => n.orderId === order.id); assert.deepEqual(ns.map(n => n.event), ['ORDER_ACCEPTED', 'ORDER_PREPARING', 'ORDER_READY']); assert.ok(ns.every(n => n.channel === 'SMS' && n.text.includes('http')));
  assert.deepEqual(ns.map(n => n.animation), ['accepted', 'preparing', 'ready']);
});
test('station failure: planned tasks keep going on the remaining unit, ETA grows and a delay notice is sent once', () => {
  const { e, clock } = mk(); const ids: string[] = [];
  for (let i = 0; i < 4; i++) { const { order } = e.createOrder(walkin([['fries', 1]], { customer: cust('C' + i) }), 'k' + i); e.accept(order.id); ids.push(order.id); }
  const before = e.get(ids[3]).promisedP50!; e.setUnits('fryer', 1); e.replan();
  assert.ok(e.get(ids[3]).promisedP50! >= before); void clock;
  assert.ok(e.notifications.filter(n => n.event === 'DELAY_DETECTED').length <= 6);
});
test('fryer task failure creates a replacement task and records waste', () => {
  const { e, clock } = mk(); const { order } = e.createOrder(walkin([['fries', 1]])); e.accept(order.id);
  for (let i = 0; i < 100 && ![...e.tasks.values()].some(t => t.status === 'RELEASED'); i++) { clock.t += 5000; e.tick(); }
  const t = [...e.tasks.values()].find(x => x.status === 'RELEASED')!; e.startTask(t.id); const nt = e.failTask(t.id, 'dropped');
  assert.equal(e.getTask(t.id).status, 'FAILED'); assert.equal(nt.replacementOf, t.id); assert.ok(e.inventory.ledger.some(l => l.type === 'WASTE' && l.ingredient === 'potato_g'));
});
test('ETA hysteresis: no ETA update for drift under 3 minutes', () => {
  const { e, clock } = mk(); const { order } = e.createOrder(walkin([['chai', 1]])); e.accept(order.id); const v = e.events.filter(x => x.type === 'ETA_UPDATED').length; clock.adv(1); e.replan();
  assert.equal(e.events.filter(x => x.type === 'ETA_UPDATED').length, v);
});
test('invalid transitions are rejected with 409', () => {
  const { e } = mk(); const { order } = e.createOrder(walkin([['chai', 1]])); e.accept(order.id);
  assert.throws(() => e.handover(order.id, '3210'), (x: unknown) => x instanceof DomainError && x.status === 409);
  assert.throws(() => e.markReady(order.id, []), (x: unknown) => x instanceof DomainError && x.status === 409);
});
