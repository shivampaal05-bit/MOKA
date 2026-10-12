import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Engine, MIN, type Clock } from '@queuebite/core';
import { FileSnapshotStore, SqliteSnapshotStore, autosave } from '../src/store/snapshot-store.ts';
class Clk implements Clock { t = Date.UTC(2026, 9, 10, 7, 30); now() { return this.t; } }
const cust = { name: 'Asha', phone: '9876543210' };
function busyEngine() {
  const clock = new Clk(); const e = new Engine({ clock });
  const w = e.createOrder({ channel: 'COUNTER', mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'burger', qty: 2 }, { menuItemId: 'fries', qty: 1 }] }, 'idem-walkin-1').order; e.accept(w.id);
  const p = e.createOrder({ channel: 'WEB', mode: 'PREORDER', customer: cust, distanceKm: 1, slotInMin: 20, items: [{ menuItemId: 'chowmein', qty: 1 }] }, 'idem-pre-0001').order; e.confirmPayment('evt-1', p.id, p.total);
  clock.t += 2 * MIN; e.tick(); return { clock, e, w, p };
}
function sameState(a: Engine, b: Engine) {
  assert.deepEqual([...b.orders.values()].map(o => [o.id, o.token, o.status, o.version]), [...a.orders.values()].map(o => [o.id, o.token, o.status, o.version]));
  assert.deepEqual([...b.tasks.values()].map(t => [t.id, t.status]), [...a.tasks.values()].map(t => [t.id, t.status]));
  const norm = (x: unknown) => JSON.parse(JSON.stringify(x)); // storage is JSON, so compare what JSON can represent
  assert.deepEqual(norm(b.inventory.snapshot()), norm(a.inventory.snapshot()));
}

test('SQLite store: snapshot round trip restores orders, tasks, stock, tokens, idempotency and payment dedupe', async () => {
  const { clock, e, w } = busyEngine(); const store = await SqliteSnapshotStore.open(':memory:'); store.save(e.snapshot());
  const e2 = new Engine({ clock }); e2.restore(store.load() as ReturnType<Engine['snapshot']>); sameState(e, e2);
  // idempotency survives a restart: same key -> same order, no new stock reserved
  const again = e2.createOrder({ channel: 'COUNTER', mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'burger', qty: 2 }, { menuItemId: 'fries', qty: 1 }] }, 'idem-walkin-1');
  assert.equal(again.duplicate, true); assert.equal(again.order.id, w.id);
  // payment dedupe survives a restart
  assert.equal(e2.confirmPayment('evt-1', 'o2', e2.get('o2').total).duplicate, true);
  // token sequence continues instead of restarting at 001
  const n = e2.createOrder({ channel: 'COUNTER', mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'chai', qty: 1 }] }); e2.accept(n.order.id); assert.equal(n.order.token, 'W-002');
  store.close();
});

test('SQLite event log is append-only, idempotent and ordered per order', async () => {
  const { e, w } = busyEngine(); const store = await SqliteSnapshotStore.open(':memory:');
  for (const ev of e.events) { store.appendEvent(ev); store.appendEvent(ev); } // writing twice must not duplicate
  const rows = store.eventsFor(w.id) as { type: string }[]; assert.ok(rows.length >= 2); assert.equal(rows.length, e.events.filter(x => x.orderId === w.id).length); assert.equal(rows[0].type, 'ORDER_PLACED');
  store.close();
});

test('File store: atomic write, load, and autosave flushes after a change', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qb-')); const file = path.join(dir, 'state.json'); const store = new FileSnapshotStore(file);
  assert.equal(store.load(), null);
  const clock = new Clk(); const e = new Engine({ clock }); const saver = autosave(e, store, 10_000);
  const o = e.createOrder({ channel: 'COUNTER', mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'chai', qty: 1 }] }).order; e.accept(o.id);
  saver.flush(); assert.ok(fs.existsSync(file)); assert.ok(!fs.existsSync(file + '.tmp'));
  const e2 = new Engine({ clock }); e2.restore(store.load() as ReturnType<Engine['snapshot']>); sameState(e, e2);
  assert.ok(fs.readFileSync(file + '.events.ndjson', 'utf8').includes('ORDER_ACCEPTED'));
  saver.stop(); fs.rmSync(dir, { recursive: true });
});
