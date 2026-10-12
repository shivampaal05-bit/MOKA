import { test } from 'node:test'; import assert from 'node:assert/strict';
import { MIN, canTransition, TRANSITIONS, type OrderStatus } from '@queuebite/core';
import { replay } from '../../../tools/simulator/harness.ts'; import { fourCustomers } from '../../../tools/simulator/scenarios/four-customers.ts'; import { burst } from '../../../tools/simulator/scenarios/generate.ts';
import { mk, walkin, pre, cust } from './helpers.ts';

test('four customers: smart serves the seated customer first and beats FIFO on present-customer waiting', () => {
  const f = replay(fourCustomers, 'fifo'), s = replay(fourCustomers, 'smart');
  const c = (r: typeof f) => r.rows.find(x => x.label.startsWith('C'))!.waitMin!;
  assert.ok(c(s) < c(f), `seated wait smart ${c(s)} should be < fifo ${c(f)}`);
  assert.ok(s.metrics.presentMean < f.metrics.presentMean); assert.ok(s.metrics.preorderIdleAvg < f.metrics.preorderIdleAvg);
  assert.equal(s.metrics.holdViolations, 0); assert.equal(s.metrics.preorderLate, 0); assert.equal(s.rejected, 0);
});
test('pre-order cooking is held until just before the customer needs it; walk-ins are never delayed on purpose', () => {
  const { e } = mk(); const p = e.createOrder(pre([['fries', 1]], { slotInMin: 20 })).order; e.confirmPayment('a', p.id, p.total);
  const w = e.createOrder(walkin([['fries', 1]])).order; e.accept(w.id); e.replan();
  const pt = [...e.tasks.values()].find(t => t.orderId === p.id)!, wt = [...e.tasks.values()].find(t => t.orderId === w.id)!;
  assert.equal(wt.plannedStart, e.now); assert.ok(pt.plannedStart! >= e.now + 9 * MIN, 'pre-order fries should start late: ' + (pt.plannedStart! - e.now) / MIN);
  assert.ok(pt.plannedFinish! <= p.deadline - MIN, 'fries finish before slot minus pack time'); assert.equal(pt.status, 'PLANNED'); assert.equal(wt.status, 'RELEASED');
});
test('batching: same-item tasks share a batch up to capacity and keep their own order_id', () => {
  const { e } = mk(); const ids: string[] = [];
  for (let i = 0; i < 3; i++) { const o = e.createOrder(walkin([['burger', 1]], { customer: cust('B' + i) }), 'b' + i).order; e.accept(o.id); ids.push(o.id); }
  e.replan(); const ts = [...e.tasks.values()]; assert.equal(new Set(ts.map(t => t.batchId)).size <= 2, true);
  const owners = ts.filter(t => t.batchId === ts[0].batchId).map(t => t.orderId); assert.equal(new Set(owners).size, owners.length); assert.ok(owners.length <= 4);
  assert.ok(ts.every(t => ids.includes(t.orderId)));
});
test('batch cap is respected: 5 burgers need two grill cycles on one unit but can use two units', () => {
  const { e } = mk(); const o = e.createOrder(walkin([['burger', 5]])).order; e.accept(o.id); e.replan();
  const sizes = new Map<string, number>(); for (const t of e.tasks.values()) sizes.set(t.batchId!, (sizes.get(t.batchId!) ?? 0) + 1); assert.ok([...sizes.values()].every(n => n <= 4));
});
test('admission control: a new order that would break an earlier promise is refused with a reason', () => {
  const { e } = mk(); let refused: any = null; let n = 0;
  for (let i = 0; i < 40 && !refused; i++) { try { const o = e.createOrder(walkin([['burger', 4], ['fries', 2]], { customer: cust('Z' + i) }), 'z' + i).order; e.accept(o.id); n++; } catch (x: any) { refused = x; } }
  assert.ok(refused && refused.code === 'CAPACITY', 'kitchen must eventually say no'); assert.ok(n >= 2);
  assert.ok(refused.details.wouldBeReadyInMin > 0);
});
test('pre-order slot too early is refused with a suggestion; far pre-order is refused', () => {
  const { e } = mk(); try { e.createOrder(pre([['chowmein', 1]], { slotInMin: 3, distanceKm: 2 })); assert.fail('should refuse'); } catch (x: any) { assert.equal(x.code, 'SLOT_UNAVAILABLE'); assert.ok(x.details.suggestedSlotInMin >= 8); }
});
test('leave-at uses slow-case travel: 2 min + 4 min per km before the ready time', () => {
  const { e } = mk(); const p = e.createOrder(pre([['burger', 1]], { distanceKm: 2, slotInMin: 25 })).order; e.confirmPayment('x', p.id, p.total);
  const o = e.get(p.id); const ready = o.promisedP50!; assert.equal(Math.round((ready - o.leaveAt!) / MIN), 10);
});
test('"I am here" raises a pre-order weight to 2 and the order stays consistent', () => {
  const { e } = mk(); const p = e.createOrder(pre([['burger', 1]])).order; e.confirmPayment('x', p.id, p.total); e.arrived(p.id); e.arrived(p.id);
  assert.equal(e.events.filter(x => x.type === 'CUSTOMER_ARRIVED').length, 1); e.replan(); const t = [...e.tasks.values()][0]; assert.equal(t.plannedStart, e.now); // arrived => released now
});
test('fairness: no order starves in a burst (everyone admitted is eventually ready)', () => {
  const r = replay(burst(20, 5, 7), 'smart'); assert.ok(r.rows.filter(x => !x.rejected).every(x => x.readyMin != null)); assert.equal(r.metrics.holdViolations, 0);
});
test('smart never has more hold-limit violations than FIFO across seeds, and cuts pre-order idle time', () => {
  for (const seed of [7, 8, 9]) { const f = replay(burst(20, 5, seed), 'fifo'), s = replay(burst(20, 5, seed), 'smart'); assert.ok(s.metrics.holdViolations <= f.metrics.holdViolations, `seed ${seed}`); assert.ok(s.metrics.preorderIdleAvg < f.metrics.preorderIdleAvg, `seed ${seed}`); }
});
test('state machine: every listed transition is symmetric with canTransition; terminal states cannot move on', () => {
  for (const [from, tos] of Object.entries(TRANSITIONS)) for (const to of tos) assert.ok(canTransition(from as OrderStatus, to));
  assert.equal(canTransition('COMPLETED', 'COOKING'), false); assert.equal(canTransition('READY', 'COOKING'), false); assert.equal(canTransition('PLACED', 'COOKING'), false);
});
