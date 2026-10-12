import { DomainError, Engine, MIN, type CreateOrderInput, type Policy, type StationId } from '@queuebite/core';
import { Router, json, type Ctx } from './http/router.ts';
import { CAN, RateLimiter, hmacHex, pinsFromEnv, requireRole, safeEqual, type Role } from './http/auth.ts';
import { SCENARIOS } from './demo.ts';

export interface AppOptions { engine: Engine; env?: Record<string, string | undefined>; dev?: boolean; later?: (fn: () => void, ms: number) => void; speed?: number; autopilot?: { on: boolean } }
const enc = new TextEncoder();

export function createApp(o: AppOptions) {
  const { engine: e } = o; const env = o.env ?? {}; const pins = pinsFromEnv(env); const secret = env.PAYMENT_WEBHOOK_SECRET ?? 'dev-secret'; const dev = o.dev ?? true;
  const auto = o.autopilot ?? { on: false }; const speed = o.speed ?? 1; const later = o.later ?? ((fn, ms) => { setTimeout(fn, ms); });
  const orderLimiter = new RateLimiter(10, 60_000); const staff = (c: Ctx, cap: keyof typeof CAN): Role => requireRole(c.req, pins, cap);
  const r = new Router();
  const keyOf = (c: Ctx) => c.url.searchParams.get('key') ?? c.req.headers.get('x-order-key') ?? '';
  /** customer access: unguessable key from the tracking link; staff PIN also works */
  const orderFor = (c: Ctx, id: string) => { const ord = e.get(id); const pinRole = pins[c.req.headers.get('x-staff-pin') ?? '']; if (!pinRole && !safeEqual(keyOf(c), ord.accessKey)) throw new DomainError('NOT_FOUND', 'Order not found', 404); return ord; };
  const ifMatch = (c: Ctx, id: string) => { const h = c.req.headers.get('if-match'); if (h != null && Number(h) !== e.get(id).version) throw new DomainError('STALE_VERSION', 'The order changed; reload and retry', 409, { currentVersion: e.get(id).version }); };
  const pub = (ord: ReturnType<Engine['get']>) => ({ ...e.live(ord.id), accessKey: ord.accessKey });
  const idem = (c: Ctx) => { const k = c.req.headers.get('idempotency-key'); if (!k || k.length < 8) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (8+ chars)', 400); return k; };

  r.get('/health', () => json({ ok: true, policy: e.policy, now: e.now, units: e.unitsOnline }));
  r.get('/menu', () => json({ items: e.menuView() }));
  // lobby TV: tokens only, no personal data
  r.get('/board', () => { e.tick(); const all = [...e.orders.values()]; return json({ preparing: all.filter(x => ['SCHEDULED', 'COOKING', 'ASSEMBLY', 'EXPO_CHECK'].includes(x.status) && x.token && (x.mode !== 'PREORDER' || x.arrived || (x.plannedReadyAt ?? Infinity) - e.now < 12 * MIN)).map(x => x.token), ready: all.filter(x => x.status === 'READY' && (x.readyNotifyAt ?? 0) <= e.now).map(x => x.token) }); });
  // ---- customers ----
  r.post('/orders', c => {
    const b = c.body as CreateOrderInput; if (b?.customer?.phone) orderLimiter.check('phone:' + b.customer.phone);
    if (b.channel === 'COUNTER') throw new DomainError('FORBIDDEN', 'Counter orders are created by staff', 403);
    const k = idem(c); const res = e.createOrder({ ...b, paymentMode: undefined }, k); e.tick();
    return json({ order: pub(res.order), duplicate: res.duplicate, payment: res.order.status === 'PLACED' ? { required: true, amount: res.order.total, holdExpiresAt: res.order.holdExpiresAt } : { required: false } }, res.duplicate ? 200 : 201);
  });
  r.get('/orders/:id', c => json(pub(orderFor(c, c.params.id))));
  r.get('/orders/:id/live', c => json(pub(orderFor(c, c.params.id))));
  r.get('/orders/:id/eta', c => { const l = e.live(orderFor(c, c.params.id).id); return json({ eta: l.eta, leaveAt: l.leaveAt }); });
  r.post('/orders/:id/cancel', c => { const ord = orderFor(c, c.params.id); ifMatch(c, ord.id); const hasPin = !!pins[c.req.headers.get('x-staff-pin') ?? '']; let manager = false; let refund: 'FULL' | 'PARTIAL' | 'NONE' | undefined;
    if (hasPin) { const role = staff(c, 'order.cancel.staff'); manager = role === 'manager'; refund = manager ? c.body?.refund : undefined; }
    const out = e.cancel(ord.id, { manager, refund, reason: c.body?.reason }); e.tick(); return json(pub(out)); });
  r.post('/orders/:id/arrived', c => { const ord = orderFor(c, c.params.id); e.arrived(ord.id); e.tick(); return json(pub(ord)); });
  r.post('/orders/:id/leaving', c => { const ord = orderFor(c, c.params.id); e.leaving(ord.id); return json(pub(ord)); });
  r.get('/orders/:id/stream', c => { const ord = orderFor(c, c.params.id); return sse(e, ev => ev.orderId === ord.id, () => pub(ord)); });
  // ---- payments ----
  r.post('/webhooks/payments', async c => {
    const raw = (c as any).raw as string; const sig = c.req.headers.get('x-signature') ?? '';
    if (!safeEqual(await hmacHex(secret, raw), sig)) throw new DomainError('BAD_SIGNATURE', 'Webhook signature invalid', 401);
    const b = c.body as { provider_event_id: string; order_id: string; amount: number }; const res = e.confirmPayment(b.provider_event_id, b.order_id, b.amount); e.tick();
    return json({ ok: true, duplicate: res.duplicate }); // always 200 once recorded
  });
  if (dev) r.post('/dev/pay/:id', async c => { const ord = orderFor(c, c.params.id); const body = JSON.stringify({ provider_event_id: 'dev-' + ord.id, order_id: ord.id, amount: ord.total }); const res = e.confirmPayment('dev-' + ord.id, ord.id, ord.total); e.tick(); void body; return json({ ok: true, duplicate: res.duplicate, order: pub(e.get(ord.id)) }); });
  // ---- staff: orders ----
  r.post('/staff/orders', c => { const role = staff(c, 'order.create.staff'); const k = idem(c); const b = c.body as CreateOrderInput;
    if (role === 'waiter' && b.mode !== 'DINE_IN') throw new DomainError('FORBIDDEN', 'Waiters create dine-in orders', 403);
    const res = e.createOrder({ ...b, channel: b.channel ?? 'COUNTER' }, k); if (res.order.status === 'PLACED' && res.order.paymentMode !== 'PREPAID') e.accept(res.order.id, c.body?.deviceSeries); e.tick(); return json({ order: pub(res.order), duplicate: res.duplicate }, 201); });
  r.get('/staff/orders', c => { staff(c, 'order.read.all'); const st = c.url.searchParams.get('status'); const list = [...e.orders.values()].filter(x => !st || st.split(',').includes(x.status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100)
    .map(x => ({ id: x.id, token: x.token, mode: x.mode, status: x.status, version: x.version, customer: x.customer.name, table: x.table ?? null, total: x.total, paid: x.paid, paymentMode: x.paymentMode, items: x.items.map(i => `${i.qty}× ${i.name}`), eta: e.live(x.id).eta, createdAt: x.createdAt, arrived: x.arrived, accessKey: x.accessKey })); return json({ orders: list }); });
  r.post('/orders/:id/accept', c => { staff(c, 'order.accept'); ifMatch(c, c.params.id); const out = e.accept(c.params.id); e.tick(); return json(pub(out)); });
  r.post('/orders/:id/pay', c => { staff(c, 'order.accept'); return json(pub(e.payTableBill(c.params.id))); });
  r.post('/orders/:id/ready', c => { staff(c, 'expo.write'); ifMatch(c, c.params.id); const out = e.markReady(c.params.id, c.body?.checked ?? []); return json(pub(out)); });
  r.post('/orders/:id/undo-ready', c => { staff(c, 'expo.write'); return json(pub(e.undoReady(c.params.id))); });
  r.post('/orders/:id/handover', c => { staff(c, 'order.handover'); return json(pub(e.handover(c.params.id, c.body?.proof ?? ''))); });
  // ---- kitchen ----
  r.get('/kds', c => { staff(c, 'kds.read'); const st = c.url.searchParams.get('station') as StationId | null; e.tick(); return json(e.kds(st ?? undefined)); });
  r.get('/expo', c => { staff(c, 'expo.read'); e.tick(); return json(e.expo()); });
  r.post('/tasks/:id/start', c => { staff(c, 'task.write'); e.startTask(c.params.id, !!c.body?.force && staff(c, 'admin') === 'manager'); e.tick(); return json({ ok: true }); });
  r.post('/tasks/:id/done', c => { staff(c, 'task.write'); e.doneTask(c.params.id); e.tick(); return json({ ok: true }); });
  r.post('/tasks/:id/fail', c => { staff(c, 'task.write'); const t = e.failTask(c.params.id, c.body?.reason ?? 'dropped'); return json({ ok: true, replacement: t.id }); });
  r.post('/stations/:id/units', c => { staff(c, 'resource.write'); e.setUnits(c.params.id as StationId, Number(c.body?.units)); return json({ units: e.unitsOnline }); });
  r.get('/stream/staff', c => { staff(c, 'order.read.all'); return sse(e, () => true, () => ({ hello: true })); });
  // ---- inventory ----
  r.get('/inventory', c => { staff(c, 'inventory.read'); return json({ items: [...e.inventory.items.values()].map(i => ({ ...i, available: i.onHand - i.reserved, status: e.inventory.status(i.id) })), menu: e.menuView().map(m => ({ id: m.id, name: m.name, portionsLeft: m.portionsLeft, available: m.available })) }); });
  r.get('/ledger', c => { staff(c, 'inventory.read'); const ing = c.url.searchParams.get('ingredient'); return json({ entries: e.inventory.ledger.filter(l => !ing || l.ingredient === ing).slice(-200).reverse() }); });
  r.post('/inventory/receipt', c => { staff(c, 'inventory.write'); e.inventory.receipt(c.body.ingredient, Number(c.body.qty)); return json({ ok: true }); });
  r.post('/inventory/adjust', c => { staff(c, 'inventory.write'); return json({ diff: e.inventory.adjust(c.body.ingredient, Number(c.body.counted), c.body.note) }); });
  r.post('/inventory/waste', c => { staff(c, 'inventory.write'); e.inventory.waste(c.body.ingredient, Number(c.body.qty), 'manual', c.body.reason ?? 'waste'); return json({ ok: true }); });
  // ---- owner / admin ----
  r.get('/admin/stats', c => { staff(c, 'admin'); return json({ ...e.stats(), autopilot: auto.on, speed, scenarios: Object.entries(SCENARIOS).map(([id, s]) => ({ id, title: s.title })) }); });
  r.get('/admin/plan', c => { staff(c, 'admin'); e.tick(); const tasks = [...e.tasks.values()].filter(t => ['PLANNED', 'RELEASED', 'COOKING', 'DONE'].includes(t.status) && e.get(t.orderId).status !== 'COMPLETED').map(t => ({ id: t.id, token: e.get(t.orderId).token, station: t.station, unit: t.unit ?? 0, item: e.menu.get(t.itemId)!.name, status: t.status, start: t.actualStart ?? t.plannedStart ?? null, end: t.actualStart ? t.actualStart + e.menu.get(t.itemId)!.cookMin * MIN : t.plannedFinish ?? null, batchId: t.batchId ?? null })); return json({ now: e.now, tasks }); });
  r.post('/admin/autopilot', c => { staff(c, 'admin'); auto.on = !!c.body?.on; return json({ autopilot: auto.on }); });
  r.post('/admin/policy', c => { staff(c, 'admin'); const p = c.body?.policy as Policy; if (!['smart', 'fifo', 'deadline'].includes(p)) throw new DomainError('BAD_POLICY', 'policy must be smart, fifo or deadline', 400); e.policy = p; e.markDirty(); e.replan(); return json({ policy: e.policy }); });
  r.post('/admin/close-day', c => { staff(c, 'admin'); e.closeDay(); return json({ ok: true }); });
  r.post('/admin/scenario/:id', c => { staff(c, 'admin'); const s = SCENARIOS[c.params.id]; if (!s) throw new DomainError('NOT_FOUND', 'Unknown scenario', 404);
    const made: string[] = [];
    s.orders.forEach((x, i) => later(() => { try { const res = e.createOrder(x.input, `scn-${c.params.id}-${e.now}-${i}`); const ord = res.order; if (ord.status === 'PLACED') { if (ord.paymentMode === 'PREPAID') e.confirmPayment(`scn-pay-${ord.id}`, ord.id, ord.total); else e.accept(ord.id); } made.push(ord.token); e.tick(); } catch { /* admission control may refuse; that is part of the demo */ } }, (x.atMin * MIN) / speed));
    return json({ scheduled: s.orders.length, title: s.title }); });
  r.get('/admin/notifications', c => { staff(c, 'admin'); return json({ notifications: e.notifications.slice(-60).reverse() }); });

  /** The fetch handler. Runs unchanged on Node (server.ts) and on Cloudflare Workers. */
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url); const requestId = crypto.randomUUID().slice(0, 8);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,idempotency-key,x-staff-pin,x-order-key,if-match,x-signature', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const m = r.match(req.method, url.pathname); if (!m) throw new DomainError('NOT_FOUND', r.pathExists(url.pathname) ? 'Method not allowed' : 'Route not found', r.pathExists(url.pathname) ? 405 : 404);
      let body: any = {}; let raw = '';
      if (req.method === 'POST') { raw = await req.text(); if (raw) { try { body = JSON.parse(raw); } catch { throw new DomainError('BAD_JSON', 'Body must be JSON', 400); } } }
      const ctx = { req, url, params: m.params, body, requestId } as Ctx & { raw: string }; ctx.raw = raw;
      const res = await m.h(ctx); const h = new Headers(res.headers); for (const [k, v] of Object.entries(cors)) h.set(k, v); h.set('x-request-id', requestId);
      return new Response(res.body, { status: res.status, headers: h });
    } catch (err) {
      if (err instanceof DomainError) return json({ error: { code: err.code, message: err.message, details: err.details, request_id: requestId } }, err.status, cors);
      console.error('unhandled', requestId, err); return json({ error: { code: 'INTERNAL', message: 'Something went wrong', request_id: requestId } }, 500, cors);
    }
  };
}

function sse(e: Engine, filter: (ev: { orderId: string }) => boolean, first: () => unknown) {
  let off = () => {}; let beat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (name: string, data: unknown) => { try { ctrl.enqueue(enc.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { off(); } };
      send('snapshot', first()); off = e.on(ev => { if (filter(ev)) send('event', { type: ev.type, orderId: ev.orderId, version: ev.version, at: ev.at }); });
      beat = setInterval(() => { try { ctrl.enqueue(enc.encode(': ping\n\n')); } catch { off(); } }, 15000);
    }, cancel() { off(); if (beat) clearInterval(beat); },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' } });
}
