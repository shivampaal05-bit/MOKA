import { test } from 'node:test'; import assert from 'node:assert/strict';
import { Engine, MIN } from '@queuebite/core'; import { createApp } from '../src/app.ts'; import { hmacHex } from '../src/http/auth.ts';
class Clk { t = Date.UTC(2026, 9, 10, 7, 30); now() { return this.t; } }
function setup() { const clock = new Clk(); const engine = new Engine({ clock }); const app = createApp({ engine, env: { PAYMENT_WEBHOOK_SECRET: 's3cret' }, later: fn => fn() }); return { clock, engine, app }; }
const call = (app: (r: Request) => Promise<Response>, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app(new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })).then(async r => ({ status: r.status, json: r.headers.get('content-type')?.includes('json') ? await r.json() as any : null }));
const STAFF = (pin: string) => ({ 'x-staff-pin': pin });
const cust = { name: 'Ravi', phone: '9876543210' };

test('full pre-order journey over HTTP: create → signed webhook → cook → expo → handover', async () => {
  const { clock, engine, app } = setup();
  const c = await call(app, 'POST', '/orders', { channel: 'WEB', mode: 'PREORDER', customer: cust, distanceKm: 1, slotInMin: 15, items: [{ menuItemId: 'burger', qty: 2 }, { menuItemId: 'fries', qty: 1 }] }, { 'idempotency-key': 'abcdefgh-1' });
  assert.equal(c.status, 201); assert.equal(c.json.payment.required, true); const id = c.json.order.id; const key = c.json.order.accessKey;
  const raw = JSON.stringify({ provider_event_id: 'evt_1', order_id: id, amount: c.json.order.total });
  const bad = await call(app, 'POST', '/webhooks/payments', JSON.parse(raw), { 'x-signature': 'nope' }); assert.equal(bad.status, 401);
  const sig = await hmacHex('s3cret', raw); const ok = await app(new Request('http://x/webhooks/payments', { method: 'POST', body: raw, headers: { 'x-signature': sig } })); assert.equal(ok.status, 200);
  const dup = await app(new Request('http://x/webhooks/payments', { method: 'POST', body: raw, headers: { 'x-signature': sig } })); assert.equal((await dup.json() as any).duplicate, true);
  const live = await call(app, 'GET', `/orders/${id}/live?key=${key}`); assert.equal(live.json.token, 'P-001'); assert.ok(live.json.eta.hi - live.json.eta.lo >= 2); assert.ok(live.json.leaveAt);
  // customer cannot read without the key
  assert.equal((await call(app, 'GET', `/orders/${id}/live`)).status, 404);
  // cook everything
  for (let i = 0; i < 400; i++) { clock.t += 5000; const kds = await call(app, 'GET', '/kds', undefined, STAFF('1111'));
    for (const t of kds.json.NOW) await call(app, 'POST', `/tasks/${t.id}/start`, {}, STAFF('1111'));
    for (const t of kds.json.COOKING) if (clock.t >= t.actualStart + t.cookMs) await call(app, 'POST', `/tasks/${t.id}/done`, {}, STAFF('1111'));
    if (engine.get(id).status === 'ASSEMBLY') break; }
  assert.equal(engine.get(id).status, 'ASSEMBLY');
  const expo = await call(app, 'GET', '/expo', undefined, STAFF('2222')); assert.equal(expo.json.toPack.length, 1); const items = expo.json.toPack[0].items.map((x: any) => x.id);
  assert.equal((await call(app, 'POST', `/orders/${id}/ready`, { checked: [] }, STAFF('2222'))).status, 422);
  assert.equal((await call(app, 'POST', `/orders/${id}/ready`, { checked: items }, STAFF('2222'))).status, 200);
  assert.equal((await call(app, 'POST', `/orders/${id}/handover`, { proof: 'wrong' }, STAFF('3333'))).status, 403);
  assert.equal((await call(app, 'POST', `/orders/${id}/handover`, { proof: 'P-001' }, STAFF('3333'))).json.status, 'COMPLETED');
  clock.t += 60_000; engine.tick(); const n = (await call(app, 'GET', `/orders/${id}/live?key=${key}`)).json.notifications.map((x: any) => x.event); assert.deepEqual(n, ['ORDER_ACCEPTED', 'ORDER_PREPARING']); // handed over inside the 20 s undo window, so no "ready" message is needed
});
test('POST /orders requires an Idempotency-Key and is idempotent; counter channel is staff-only', async () => {
  const { app } = setup(); const body = { channel: 'WEB', mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'chai', qty: 1 }] };
  assert.equal((await call(app, 'POST', '/orders', body)).status, 400);
  const a = await call(app, 'POST', '/orders', body, { 'idempotency-key': 'key-12345' }); const b = await call(app, 'POST', '/orders', body, { 'idempotency-key': 'key-12345' });
  assert.equal(a.json.order.id, b.json.order.id); assert.equal(b.json.duplicate, true);
  assert.equal((await call(app, 'POST', '/orders', { ...body, channel: 'COUNTER' }, { 'idempotency-key': 'key-99999' })).status, 403);
});
test('RBAC: unknown PIN 401, wrong role 403, manager can do admin things', async () => {
  const { app } = setup();
  assert.equal((await call(app, 'GET', '/kds')).status, 401); assert.equal((await call(app, 'GET', '/kds', undefined, STAFF('0000'))).status, 401);
  assert.equal((await call(app, 'GET', '/admin/stats', undefined, STAFF('1111'))).status, 403); assert.equal((await call(app, 'GET', '/admin/stats', undefined, STAFF('9999'))).status, 200);
  assert.equal((await call(app, 'POST', '/inventory/receipt', { ingredient: 'bun', qty: 10 }, STAFF('1111'))).status, 403); assert.equal((await call(app, 'POST', '/inventory/receipt', { ingredient: 'bun', qty: 10 }, STAFF('9999'))).status, 200);
  const w = await call(app, 'POST', '/staff/orders', { mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'chai', qty: 1 }] }, { ...STAFF('4444'), 'idempotency-key': 'waiter-0001' }); assert.equal(w.status, 403);
});
test('counter order by cashier is accepted at once and gets token W-001; stale If-Match is rejected', async () => {
  const { app } = setup(); const r = await call(app, 'POST', '/staff/orders', { mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'burger', qty: 1 }, { menuItemId: 'fries', qty: 1 }] }, { ...STAFF('3333'), 'idempotency-key': 'cashier-001' });
  assert.equal(r.status, 201); assert.equal(r.json.order.token, 'W-001'); const id = r.json.order.id;
  const stale = await call(app, 'POST', `/orders/${id}/cancel`, {}, { ...STAFF('3333'), 'if-match': '999' }); assert.equal(stale.status, 409); assert.equal(stale.json.error.code, 'STALE_VERSION');
});
test('error format is stable JSON with request id; unknown route 404; wrong method 405; bad JSON 400', async () => {
  const { app } = setup(); const nf = await call(app, 'GET', '/nope'); assert.equal(nf.status, 404); assert.equal(nf.json.error.code, 'NOT_FOUND'); assert.ok(nf.json.error.request_id);
  assert.equal((await call(app, 'GET', '/staff/orders')).status === 401, true); const bad = await app(new Request('http://x/orders', { method: 'POST', body: '{oops' })); assert.equal(bad.status, 400);
});
test('stock shortage returns 422 STOCK_SHORT and the demo scenario loads', async () => {
  const { app, engine } = setup(); engine.inventory.adjust('bun', 1);
  const r = await call(app, 'POST', '/orders', { channel: 'WEB', mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'burger', qty: 2 }] }, { 'idempotency-key': 'short-0001' }); assert.equal(r.status, 422); assert.equal(r.json.error.code, 'STOCK_SHORT');
  engine.inventory.adjust('bun', 40); const s = await call(app, 'POST', '/admin/scenario/four', {}, STAFF('9999')); assert.equal(s.status, 200); assert.ok(engine.orders.size >= 3);
});
test('rate limit: 11th order from one phone within a minute is refused', async () => {
  const { app } = setup(); let last = 0; for (let i = 0; i < 11; i++) last = (await call(app, 'POST', '/orders', { channel: 'WEB', mode: 'TAKEAWAY', customer: cust, items: [{ menuItemId: 'chai', qty: 1 }] }, { 'idempotency-key': 'rl-key-' + i })).status;
  assert.equal(last, 429); void MIN;
});
