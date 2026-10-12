import { DomainError, MIN, type Channel, type Clock, type Mode, type Notification, type Order, type OrderEvent, type OrderItem, type OrderStatus, type PaymentMode, type Policy, type StationId, type Task } from './types.ts';
import { INGREDIENTS, MENU, SETTINGS, STATIONS, type Settings } from './config/menu.ts';
import { assertTransition } from './orders/state-machine.ts';
import { TokenIssuer } from './orders/tokens.ts';
import { Inventory, needsFor } from './inventory/ledger.ts';
import { plan, type PlanResult } from './scheduler/plan.ts';
import { ceilToStep, makeQuote } from './scheduler/eta.ts';
import { ANIMATION, render, type NotifyEvent } from './notifications/templates.ts';

export interface CreateOrderInput {
  channel: Channel; mode: Mode; customer: { name: string; phone: string }; items: { menuItemId: string; qty: number }[];
  table?: string; distanceKm?: number; slotInMin?: number; paymentMode?: PaymentMode; deviceSeries?: string;
}
export interface EngineOptions { clock: Clock; policy?: Policy; settings?: Settings; trackingBase?: string; failWhatsapp?: boolean }
type Listener = (e: OrderEvent) => void;

export class Engine {
  clock: Clock; policy: Policy; S: Settings; trackingBase: string; failWhatsapp: boolean;
  menu = new Map(MENU.map(m => [m.id, m])); stations = new Map(STATIONS.map(s => [s.id, s]));
  unitsOnline: Record<string, number> = Object.fromEntries(STATIONS.map(s => [s.id, s.units]));
  orders = new Map<string, Order>(); tasks = new Map<string, Task>(); events: OrderEvent[] = []; notifications: Notification[] = [];
  inventory: Inventory; tokens = new TokenIssuer();
  private idem = new Map<string, { orderId: string }>(); private paymentEvents = new Set<string>(); private reserved = new Map<string, ReturnType<typeof needsFor>>();
  private listeners = new Set<Listener>(); private seq = { order: 0, task: 0, item: 0, event: 0, notif: 0 };
  private dirty = true; private lastPlanAt = 0; lastPlan: PlanResult = { tasks: new Map(), orders: new Map() };
  businessDay: string;
  constructor(o: EngineOptions) {
    this.clock = o.clock; this.policy = o.policy ?? 'smart'; this.S = o.settings ?? SETTINGS; this.trackingBase = o.trackingBase ?? 'https://track.example/o'; this.failWhatsapp = !!o.failWhatsapp;
    this.inventory = new Inventory(INGREDIENTS, o.clock); this.businessDay = this.dayKey();
  }
  private dayKey() { return new Date(this.clock.now() + 5.5 * 3600_000).toISOString().slice(0, 10); }
  on(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit(o: Order, type: string, data?: Record<string, unknown>) {
    const e: OrderEvent = { id: ++this.seq.event, orderId: o.id, type, version: o.version, at: this.clock.now(), data }; this.events.push(e);
    for (const l of this.listeners) { try { l(e); } catch { /* listener errors never break the kitchen */ } }
    this.notifyFor(o, type);
  }
  private bump(o: Order) { o.version++; }
  private setStatus(o: Order, to: OrderStatus) { assertTransition(o.status, to); o.status = to; this.bump(o); }
  get now() { return this.clock.now(); }

  // ---------- planning ----------
  liveTasks() { return [...this.tasks.values()].filter(t => { const o = this.orders.get(t.orderId); return o && ['ACCEPTED', 'SCHEDULED', 'COOKING', 'ASSEMBLY', 'EXPO_CHECK'].includes(o.status); }); }
  private runPlan(extraOrders?: Order[], extraTasks?: Task[], immediate?: Set<string>): PlanResult {
    const orders = new Map(this.orders); for (const o of extraOrders ?? []) orders.set(o.id, o);
    return plan({ now: this.now, policy: this.policy, settings: this.S, tasks: [...this.liveTasks(), ...(extraTasks ?? [])], orders, menu: this.menu, stations: this.stations, unitsOnline: this.unitsOnline, immediate });
  }
  /** Re-plan, apply start times, release due tasks, and keep customer promises honest (hysteresis). */
  replan() {
    const res = this.runPlan(); this.lastPlan = res; this.lastPlanAt = this.now; this.dirty = false;
    for (const t of this.liveTasks()) {
      if (['PLANNED', 'READY', 'RELEASED'].includes(t.status)) {
        const p = res.tasks.get(t.id);
        if (!p) { if (t.status !== 'PLANNED') t.status = 'BLOCKED'; continue; }
        t.plannedStart = p.start; t.plannedFinish = p.finish; t.unit = p.unit; t.batchId = p.batchId;
        t.status = p.start <= this.now ? 'RELEASED' : 'PLANNED';
      } else if (t.status === 'BLOCKED') { t.status = 'PLANNED'; }
    }
    for (const [oid, op] of res.orders) {
      const o = this.orders.get(oid)!; o.plannedReadyAt = op.readyAt;
      if (o.promisedP50 != null && Math.abs(op.readyAt - o.promisedP50) >= this.S.etaHysteresisMin * MIN && !['READY', 'HANDED_OVER'].includes(o.status)) {
        const later = op.readyAt > o.promisedP50; const q = makeQuote(op.readyAt, this.now, this.now);
        // pre-orders waiting for their slot are *meant* to be planned near the slot; only treat real slips as delays
        const slipped = o.mode !== 'PREORDER' || op.readyAt > o.deadline + this.S.etaHysteresisMin * MIN || !later;
        if (slipped) { o.promisedP50 = q.p50; o.promisedP80 = q.p80; o.promisedP90 = q.p90; this.bump(o); this.emit(o, 'ETA_UPDATED', { lo: q.lo, hi: q.hi, later }); }
      }
    }
  }
  markDirty() { this.dirty = true; }

  // ---------- commands ----------
  createOrder(inp: CreateOrderInput, idemKey?: string): { order: Order; duplicate: boolean } {
    if (idemKey && this.idem.has(idemKey)) return { order: this.orders.get(this.idem.get(idemKey)!.orderId)!, duplicate: true };
    if (!inp.items?.length) throw new DomainError('EMPTY_ORDER', 'Order has no items', 400);
    if (!inp.customer?.name || !/^\+?\d{8,15}$/.test((inp.customer.phone ?? '').replace(/\s/g, ''))) throw new DomainError('BAD_CUSTOMER', 'Name and valid phone are required', 400);
    if (inp.mode === 'DINE_IN' && !inp.table) throw new DomainError('TABLE_REQUIRED', 'Dine-in order needs a table', 400);
    const items: OrderItem[] = []; let total = 0;
    for (const l of inp.items) {
      const m = this.menu.get(l.menuItemId); if (!m) throw new DomainError('UNKNOWN_ITEM', `Unknown item ${l.menuItemId}`, 400);
      if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) throw new DomainError('BAD_QTY', 'qty must be 1–20', 400);
      items.push({ id: `i${++this.seq.item}`, menuItemId: m.id, name: m.name, qty: l.qty, price: m.price }); total += m.price * l.qty; // price comes from the menu, never from the client
    }
    const packaging = inp.mode !== 'DINE_IN'; const needs = needsFor(this.menu, items, packaging);
    const paymentMode: PaymentMode = inp.paymentMode ?? (inp.mode === 'PREORDER' ? 'PREPAID' : inp.mode === 'TAKEAWAY' ? 'COUNTER' : 'TABLE_BILL');
    if (inp.mode === 'PREORDER' && paymentMode !== 'PREPAID') throw new DomainError('PREPAY_REQUIRED', 'Pre-orders must be paid online first', 400);
    const now = this.now; const id = `o${++this.seq.order}`;
    const o: Order = { id, token: '', channel: inp.channel, mode: inp.mode, status: 'PLACED', version: 1, customer: inp.customer, table: inp.table, distanceKm: inp.distanceKm,
      items, total, paymentMode, paid: false, createdAt: now, acceptedAt: undefined, deadline: now, arrived: false, leaving: false, idempotencyKey: idemKey,
      businessDay: this.businessDay, refund: 'NONE', refundAmount: 0, delayNotices: 0, accessKey: globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20) };
    // admission control: plan the order tentatively and refuse/re-slot it if it would break any promise already made
    const tasks = this.makeTasks(o); const baseline = this.runPlan();
    const harmed = (res: PlanResult) => { const out: string[] = []; for (const [oid, op] of res.orders) { const ex = this.orders.get(oid); if (!ex || oid === o.id) continue; const before = baseline.orders.get(oid)?.readyAt; const limit = ex.mode === 'PREORDER' ? ex.deadline + 2 * MIN : Math.max(ex.promisedP90 ?? 0, ex.deadline); if (op.readyAt > limit && (before == null || before <= limit)) out.push(ex.token || oid); } return out; };
    if (inp.mode === 'PREORDER') {
      const km = inp.distanceKm ?? 1; const travel = (this.S.travelBaseMin + this.S.travelPerKmMin * km) * MIN;
      const probe0 = { ...o, acceptedAt: now }; const earliest = this.runPlan([probe0], tasks, new Set([o.id])).orders.get(o.id)!.readyAt;
      const floor = ceilToStep(Math.max(earliest, now + travel), this.S.slotStepMin);
      const want = inp.slotInMin != null ? ceilToStep(now + inp.slotInMin * MIN, this.S.slotStepMin) : floor;
      let slot = Math.max(want, floor); let found = false;
      for (; slot - now <= this.S.preorderMaxAheadMin * MIN; slot += this.S.slotStepMin * MIN) {
        const probe = { ...o, acceptedAt: now, deadline: slot, slotAt: slot }; const res = this.runPlan([probe], tasks);
        if (res.orders.get(o.id)!.readyAt <= slot + 1 * MIN && harmed(res).length === 0) { found = true; break; }
      }
      if (!found) throw new DomainError('CAPACITY', 'No pickup slot is available in the next two hours', 422);
      if (inp.slotInMin != null && slot > want) throw new DomainError('SLOT_UNAVAILABLE', 'That pickup slot is not available', 422, { suggestedSlotInMin: Math.ceil((slot - now) / MIN) });
      o.slotAt = slot; o.deadline = slot;
    } else {
      const probe = { ...o, acceptedAt: now }; const res = this.runPlan([probe], tasks, new Set([o.id])); const earliest = res.orders.get(o.id)!.readyAt; const hurt = harmed(res);
      if (earliest - now > this.S.maxWaitMin * MIN || hurt.length) throw new DomainError('CAPACITY', 'Kitchen is at capacity right now', 422, { wouldBeReadyInMin: Math.ceil((earliest - now) / MIN), wouldDelay: hurt });
      o.deadline = earliest;
    }
    this.inventory.reserve(needs, id); this.reserved.set(id, needs); // throws STOCK_SHORT atomically
    o.token = '';
    this.orders.set(id, o); if (idemKey) this.idem.set(idemKey, { orderId: id });
    for (const t of tasks) this.tasks.set(t.id, t);
    if (paymentMode === 'PREPAID') o.holdExpiresAt = now + this.S.paymentHoldMin * MIN;
    this.emit(o, 'ORDER_PLACED', { total });
    if (paymentMode === 'TABLE_BILL' || inp.mode === 'DINE_IN') this.accept(o.id, inp.deviceSeries); // dine-in runs on a table bill: kitchen starts now
    return { order: o, duplicate: false };
  }
  private makeTasks(o: Order): Task[] {
    const ts: Task[] = [];
    for (const it of o.items) { const m = this.menu.get(it.menuItemId)!; for (let k = 0; k < it.qty; k++) ts.push({ id: `t${++this.seq.task}`, orderId: o.id, orderItemId: it.id, itemId: m.id, station: m.station, status: 'PLANNED', version: 1 }); }
    return ts;
  }
  /** Cashier / waiter confirms a counter or table order (payment taken or table bill opened). */
  accept(orderId: string, deviceSeries?: string) {
    const o = this.get(orderId); if (o.status !== 'PLACED' && o.status !== 'PAID') throw new DomainError('INVALID_TRANSITION', `Order is ${o.status}`, 409);
    if (o.paymentMode !== 'TABLE_BILL') o.paid = true;
    if (o.status === 'PLACED' && o.paymentMode === 'PREPAID') throw new DomainError('PAYMENT_REQUIRED', 'Prepaid order is not paid yet', 409);
    o.token = this.tokens.next(o.mode, deviceSeries); o.acceptedAt = this.now; o.holdExpiresAt = undefined;
    this.setStatus(o, 'ACCEPTED'); this.setStatus(o, 'SCHEDULED');
    // quote
    const km = o.distanceKm ?? 1; this.replanQuiet(); const op = this.lastPlan.orders.get(o.id); const ready = op?.readyAt ?? o.deadline;
    const q = makeQuote(ready, this.now, this.now); o.promisedP50 = q.p50; o.promisedP80 = q.p80; o.promisedP90 = q.p90;
    if (o.mode === 'PREORDER') { const slow = (this.S.travelBaseMin + this.S.travelPerKmMin * km) * MIN; o.leaveAt = Math.max(this.now, ready - slow); }
    this.emit(o, 'ORDER_ACCEPTED', { lo: q.lo, hi: q.hi, token: o.token });
    this.markDirty(); return o;
  }
  private replanQuiet() { const res = this.runPlan(); this.lastPlan = res; for (const t of this.liveTasks()) { const p = res.tasks.get(t.id); if (p && ['PLANNED', 'READY', 'RELEASED'].includes(t.status)) { t.plannedStart = p.start; t.plannedFinish = p.finish; t.unit = p.unit; t.batchId = p.batchId; } } }
  /** Payment gateway webhook. Idempotent on providerEventId; amount is verified against the server-side total. */
  confirmPayment(providerEventId: string, orderId: string, amount: number): { duplicate: boolean; order: Order } {
    if (this.paymentEvents.has(providerEventId)) return { duplicate: true, order: this.get(orderId) };
    const o = this.get(orderId); this.paymentEvents.add(providerEventId);
    if (amount !== o.total) throw new DomainError('AMOUNT_MISMATCH', 'Paid amount does not match the order total', 422, { expected: o.total, got: amount });
    if (o.status === 'EXPIRED' || o.status === 'CANCELLED') { o.refund = 'REFUND_PENDING'; o.refundAmount = amount; this.emit(o, 'REFUND_PENDING', { reason: 'paid after ' + o.status }); return { duplicate: false, order: o }; }
    if (o.status !== 'PLACED') return { duplicate: true, order: o };
    o.paid = true; this.setStatus(o, 'PAID'); this.emit(o, 'PAYMENT_CONFIRMED', { amount }); this.accept(o.id); return { duplicate: false, order: o };
  }
  startTask(taskId: string, force = false) {
    const t = this.getTask(taskId); const o = this.get(t.orderId);
    if (t.status === 'COOKING') return t; // idempotent
    if (!force && t.status !== 'RELEASED') throw new DomainError('NOT_RELEASED', `Task is ${t.status}; the scheduler has not released it yet`, 409);
    const batch = t.batchId ? [...this.tasks.values()].filter(x => x.batchId === t.batchId && x.status === 'RELEASED' && x.station === t.station && x.itemId === t.itemId) : [t];
    const all = batch.includes(t) ? batch : [t, ...batch];
    for (const x of all.slice(0, this.menu.get(t.itemId)!.batchCap)) {
      const xo = this.get(x.orderId); x.status = 'COOKING'; x.actualStart = this.now; x.version++;
      const m = this.menu.get(x.itemId)!; const part = this.portionNeeds(x, m); this.inventory.consume(part, x.id); // point of no return for stock
      if (xo.status === 'SCHEDULED') { this.setStatus(xo, 'COOKING'); this.emit(xo, 'ORDER_PREPARING', {}); } else if (xo.status === 'ASSEMBLY' || xo.status === 'EXPO_CHECK') { this.setStatus(xo, 'COOKING'); }
      this.emit(xo, 'COOK_STARTED', { task: x.id, item: m.name });
    }
    void o; this.markDirty(); return t;
  }
  private portionNeeds(t: Task, m: ReturnType<Engine['menu']['get']> & {}) { const n = new Map<string, number>(); for (const r of m.recipe) if (!r.pack) n.set(r.ingredient, r.qty); return n; }
  doneTask(taskId: string) {
    const t = this.getTask(taskId); if (t.status === 'DONE') return t;
    if (t.status !== 'COOKING') throw new DomainError('NOT_COOKING', `Task is ${t.status}`, 409);
    const batch = t.batchId ? [...this.tasks.values()].filter(x => x.batchId === t.batchId && x.status === 'COOKING' && x.itemId === t.itemId) : [t];
    for (const x of (batch.includes(t) ? batch : [t, ...batch])) { x.status = 'DONE'; x.actualFinish = this.now; x.version++; this.afterTaskDone(x); }
    this.markDirty(); return t;
  }
  private afterTaskDone(t: Task) {
    const o = this.get(t.orderId); const mine = [...this.tasks.values()].filter(x => x.orderId === o.id && !['CANCELLED', 'FAILED'].includes(x.status));
    if (mine.every(x => x.status === 'DONE') && o.status === 'COOKING') { this.setStatus(o, 'ASSEMBLY'); this.emit(o, 'ASSEMBLY_STARTED', {}); }
  }
  /** Food dropped / burnt: portions go to WASTE and a replacement task is created (re-fire). */
  failTask(taskId: string, reason = 'dropped') {
    const t = this.getTask(taskId); const o = this.get(t.orderId); const m = this.menu.get(t.itemId)!;
    if (!['COOKING', 'DONE'].includes(t.status)) throw new DomainError('NOT_STARTED', 'Only started tasks can fail', 409);
    t.status = 'FAILED'; t.version++;
    for (const r of m.recipe) if (!r.pack) this.inventory.waste(r.ingredient, r.qty, t.id, reason);
    const need = new Map<string, number>(); for (const r of m.recipe) if (!r.pack) need.set(r.ingredient, r.qty);
    this.inventory.reserve(need, t.id); // replacement portion (throws STOCK_SHORT if none left)
    const nt: Task = { id: `t${++this.seq.task}`, orderId: o.id, orderItemId: t.orderItemId, itemId: t.itemId, station: t.station, status: 'PLANNED', version: 1, replacementOf: t.id };
    this.tasks.set(nt.id, nt);
    if (['ASSEMBLY', 'EXPO_CHECK'].includes(o.status)) this.setStatus(o, 'COOKING');
    this.emit(o, 'TASK_FAILED', { task: t.id, reason, replacement: nt.id }); this.markDirty(); this.replan(); return nt;
  }
  setUnits(station: StationId, units: number) { const st = this.stations.get(station); if (!st) throw new DomainError('UNKNOWN_STATION', station, 400); this.unitsOnline[station] = Math.max(0, Math.min(units, st.units)); this.markDirty(); this.replan(); for (const o of this.orders.values()) if (o.status === 'SCHEDULED' || o.status === 'COOKING') this.emit(o, 'RESOURCE_CHANGED', { station, units: this.unitsOnline[station] }); }
  /** Expo: every item must be present. READY is a human tap; the customer message is held for the undo window. */
  markReady(orderId: string, checked: string[]) {
    const o = this.get(orderId);
    if (o.status === 'READY') return o; // idempotent
    if (!['ASSEMBLY', 'EXPO_CHECK'].includes(o.status)) throw new DomainError('NOT_READY_FOR_EXPO', `Order is ${o.status}; not all tasks are done`, 409);
    const need = o.items.map(i => i.id); const missing = need.filter(id => !checked.includes(id));
    if (missing.length) throw new DomainError('EXPO_ITEMS_MISSING', 'Every item must be checked before READY', 422, { missing });
    if (o.status === 'ASSEMBLY') this.setStatus(o, 'EXPO_CHECK');
    // packaging consumed at pack time
    const pk = new Map<string, number>(); const full = this.reserved.get(o.id);
    for (const it of o.items) { const m = this.menu.get(it.menuItemId)!; for (const r of m.recipe) if (r.pack && o.mode !== 'DINE_IN') pk.set(r.ingredient, (pk.get(r.ingredient) ?? 0) + r.qty * it.qty); }
    void full; if (pk.size) this.inventory.consume(pk, o.id);
    this.setStatus(o, 'READY'); o.readyAt = this.now; o.readyNotifyAt = this.now + this.S.readyUndoSec * 1000;
    this.emit(o, 'ORDER_READY', {}); this.markDirty(); return o;
  }
  undoReady(orderId: string) {
    const o = this.get(orderId); if (o.status !== 'READY') throw new DomainError('INVALID_TRANSITION', 'Order is not READY', 409);
    if (o.readyNotifyAt != null && this.now >= o.readyNotifyAt) throw new DomainError('UNDO_WINDOW_PASSED', 'The customer was already notified', 409);
    this.setStatus(o, 'EXPO_CHECK'); o.readyAt = undefined; o.readyNotifyAt = undefined; this.emit(o, 'READY_UNDONE', {}); return o;
  }
  arrived(orderId: string) { const o = this.get(orderId); if (!['ACCEPTED', 'SCHEDULED', 'COOKING', 'ASSEMBLY', 'EXPO_CHECK', 'READY'].includes(o.status)) throw new DomainError('INVALID_TRANSITION', `Order is ${o.status}`, 409); if (!o.arrived) { o.arrived = true; this.bump(o); this.emit(o, 'CUSTOMER_ARRIVED', {}); this.markDirty(); } return o; }
  leaving(orderId: string) { const o = this.get(orderId); o.leaving = true; this.bump(o); this.emit(o, 'CUSTOMER_LEAVING', {}); return o; }
  handover(orderId: string, proof: string) {
    const o = this.get(orderId); if (o.status === 'HANDED_OVER' || o.status === 'COMPLETED') return o; // duplicate tap returns the first record
    if (o.status !== 'READY') throw new DomainError('INVALID_TRANSITION', `Order is ${o.status}`, 409);
    const p = (proof ?? '').trim().toUpperCase(); const last4 = o.customer.phone.replace(/\D/g, '').slice(-4);
    if (p !== o.token.toUpperCase() && p !== last4) throw new DomainError('WRONG_CUSTOMER', 'Token or last 4 digits of phone do not match', 403);
    this.setStatus(o, 'HANDED_OVER'); o.handedOverAt = this.now; this.emit(o, 'ORDER_HANDED_OVER', {});
    if (o.paid) { this.setStatus(o, 'COMPLETED'); this.emit(o, 'ORDER_COMPLETED', {}); }
    return o;
  }
  payTableBill(orderId: string) { const o = this.get(orderId); if (o.paid) return o; o.paid = true; this.bump(o); if (o.status === 'HANDED_OVER') { this.setStatus(o, 'COMPLETED'); this.emit(o, 'ORDER_COMPLETED', {}); } return o; }
  /** Free before any cooking starts. After that the customer can only request; a manager decides (refund policy). */
  cancel(orderId: string, opts: { manager?: boolean; refund?: 'FULL' | 'PARTIAL' | 'NONE'; reason?: string } = {}) {
    const o = this.get(orderId);
    if (['CANCELLED', 'REFUNDED', 'REFUND_PENDING'].includes(o.status)) return o;
    const mine = [...this.tasks.values()].filter(t => t.orderId === o.id);
    const started = mine.some(t => ['COOKING', 'DONE'].includes(t.status));
    if (started && !opts.manager) throw new DomainError('COOKING_STARTED', 'Cooking has started; a manager must approve the cancellation', 409, { options: ['keep order', 'request manager review'] });
    if (!['PLACED', 'PAID', 'ACCEPTED', 'SCHEDULED', 'COOKING', 'ASSEMBLY', 'EXPO_CHECK'].includes(o.status)) throw new DomainError('INVALID_TRANSITION', `Order is ${o.status}`, 409);
    const consumedTasks = mine.filter(t => ['COOKING', 'DONE'].includes(t.status));
    for (const t of mine) if (['PLANNED', 'READY', 'RELEASED', 'BLOCKED'].includes(t.status)) t.status = 'CANCELLED';
    for (const t of consumedTasks) { const m = this.menu.get(t.itemId)!; for (const r of m.recipe) if (!r.pack) this.inventory.waste(r.ingredient, r.qty, t.id, 'order cancelled after cooking'); } // surplus is reused at the counter or recorded as waste
    // release what is still reserved: full needs minus already consumed ingredient portions
    const res = this.reserved.get(o.id); if (res) { const left = new Map(res); for (const t of consumedTasks) { const m = this.menu.get(t.itemId)!; for (const r of m.recipe) if (!r.pack) left.set(r.ingredient, (left.get(r.ingredient) ?? 0) - r.qty); } for (const [k, v] of left) if (v <= 0) left.delete(k); this.inventory.release(left, o.id); this.reserved.delete(o.id); }
    this.setStatus(o, 'CANCELLED'); o.cancelReason = opts.reason ?? 'customer request'; this.emit(o, 'ORDER_CANCELLED', { reason: o.cancelReason });
    if (o.paid && o.paymentMode !== 'TABLE_BILL') { const policy = opts.refund ?? (started ? 'PARTIAL' : 'FULL'); const amt = policy === 'FULL' ? o.total : policy === 'PARTIAL' ? Math.round(o.total * 0.5) : 0; if (amt > 0) { this.setStatus(o, 'REFUND_PENDING'); o.refund = 'REFUND_PENDING'; o.refundAmount = amt; this.emit(o, 'REFUND_PENDING', { amount: amt }); this.setStatus(o, 'REFUNDED'); o.refund = 'REFUNDED'; this.emit(o, 'REFUNDED', { amount: amt, key: `refund:${o.id}:${policy}` }); } }
    this.markDirty(); return o;
  }

  // ---------- time-driven work ----------
  tick() {
    const now = this.now;
    for (const o of this.orders.values()) {
      if (o.status === 'PLACED' && o.holdExpiresAt && now >= o.holdExpiresAt) { this.setStatus(o, 'EXPIRED'); const r = this.reserved.get(o.id); if (r) { this.inventory.release(r, o.id); this.reserved.delete(o.id); } for (const t of this.tasks.values()) if (t.orderId === o.id) t.status = 'CANCELLED'; this.emit(o, 'ORDER_EXPIRED', {}); }
      if (o.status === 'READY' && o.readyAt && now - o.readyAt >= this.S.noShowGraceMin * MIN) { this.setStatus(o, 'NO_SHOW'); this.emit(o, 'NO_SHOW', {}); }
      if (o.status === 'READY' && o.readyNotifyAt && now >= o.readyNotifyAt) this.sendReadyIfDue(o);
    }
    if (this.dirty || now - this.lastPlanAt >= 30_000) this.replan();
  }
  private sentReady = new Set<string>();
  private sendReadyIfDue(o: Order) { if (this.sentReady.has(o.id)) return; this.sentReady.add(o.id); this.dispatch(o, 'ORDER_READY'); }

  // ---------- notifications ----------
  private notifyFor(o: Order, type: string) {
    if (type === 'ORDER_ACCEPTED') this.dispatch(o, 'ORDER_ACCEPTED');
    else if (type === 'ORDER_PREPARING') this.dispatch(o, 'ORDER_PREPARING');
    else if (type === 'ETA_UPDATED') { const last = this.events[this.events.length - 1]; if (last.data?.later && o.delayNotices < this.S.maxDelayNotices) { o.delayNotices++; this.dispatch(o, 'DELAY_DETECTED'); } }
    // ORDER_READY is dispatched by tick() after the undo window
  }
  private dispatch(o: Order, ev: NotifyEvent) {
    const key = `${o.id}:${ev}:${ev === 'DELAY_DETECTED' ? o.delayNotices : 0}`; if (this.notifications.some(n => n.dedupeKey === key)) return;
    const q = makeQuote(o.promisedP50 ?? this.now, this.now, this.now); const link = `${this.trackingBase}/${o.id}`;
    const tryWa = !this.failWhatsapp; const channel = tryWa ? 'WHATSAPP' : 'SMS';
    this.notifications.push({ id: ++this.seq.notif, orderId: o.id, event: ev, channel, status: 'SENT', text: render(ev, o, q, link, channel), animation: ANIMATION[ev], at: this.now, dedupeKey: key });
  }

  // ---------- queries ----------
  get(id: string) { const o = this.orders.get(id); if (!o) throw new DomainError('NOT_FOUND', 'Order not found', 404); return o; }
  getTask(id: string) { const t = this.tasks.get(id); if (!t) throw new DomainError('NOT_FOUND', 'Task not found', 404); return t; }
  live(orderId: string) {
    const o = this.get(orderId); const q = makeQuote(o.promisedP50 ?? o.deadline, this.now, this.now); const tasks = [...this.tasks.values()].filter(t => t.orderId === o.id && t.status !== 'CANCELLED' && t.status !== 'FAILED');
    const done = tasks.filter(t => t.status === 'DONE').length; const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const phase = ['READY', 'HANDED_OVER', 'COMPLETED'].includes(o.status) ? 'ready' : ['COOKING', 'ASSEMBLY', 'EXPO_CHECK'].includes(o.status) ? 'preparing' : ['ACCEPTED', 'SCHEDULED'].includes(o.status) ? 'accepted' : o.status.toLowerCase();
    const readyVisible = !(o.status === 'READY' && o.readyNotifyAt != null && this.now < o.readyNotifyAt && false);
    return { id: o.id, token: o.token, status: o.status, phase, version: o.version, mode: o.mode, items: o.items, total: o.total, progress,
      eta: o.status === 'READY' || o.status === 'HANDED_OVER' || o.status === 'COMPLETED' ? null : { lo: q.lo, hi: q.hi, readyAt: o.promisedP50 }, leaveAt: o.leaveAt ?? null, slotAt: o.slotAt ?? null,
      arrived: o.arrived, paid: o.paid, readyVisible, notifications: this.notifications.filter(n => n.orderId === o.id) };
  }
  kds(station?: StationId) {
    const now = this.now; const tasks = this.liveTasks().filter(t => !station || t.station === station);
    const card = (t: Task) => { const o = this.get(t.orderId); const m = this.menu.get(t.itemId)!; const holdLeft = t.status === 'DONE' && t.actualFinish ? t.actualFinish + m.holdMin * MIN - now : null;
      return { id: t.id, orderId: o.id, token: o.token, mode: o.mode, item: m.name, emoji: m.emoji, station: t.station, status: t.status, batchId: t.batchId ?? null, plannedStart: t.plannedStart ?? null, plannedFinish: t.plannedFinish ?? null, actualStart: t.actualStart ?? null,
        cookMs: m.cookMin * MIN, holdLeftMs: holdLeft, arrived: o.arrived, deadline: o.deadline, table: o.table ?? null, priority: o.mode === 'TAKEAWAY' || o.arrived ? 2 : 1 }; };
    const cards = tasks.map(card);
    const atRisk = [...this.orders.values()].filter(o => ['SCHEDULED', 'COOKING', 'ASSEMBLY', 'EXPO_CHECK'].includes(o.status) && o.plannedReadyAt && o.plannedReadyAt > Math.max(o.promisedP80 ?? 0, o.mode === 'PREORDER' ? o.deadline + 2 * MIN : 0)).map(o => ({ orderId: o.id, token: o.token, readyInMin: Math.ceil((o.plannedReadyAt! - now) / MIN) }));
    const stale = cards.filter(c => c.status === 'DONE' && c.holdLeftMs != null && c.holdLeftMs < MIN).map(c => ({ taskId: c.id, token: c.token, item: c.item, holdLeftMs: c.holdLeftMs }));
    return {
      now, NOW: cards.filter(c => c.status === 'RELEASED'), COOKING: cards.filter(c => c.status === 'COOKING'),
      UPCOMING: cards.filter(c => c.status === 'PLANNED' && c.plannedStart != null && c.plannedStart - now <= 10 * MIN), LATER: cards.filter(c => c.status === 'PLANNED' && (c.plannedStart == null || c.plannedStart - now > 10 * MIN)),
      BLOCKED: cards.filter(c => c.status === 'BLOCKED'), AT_RISK: atRisk, HOLD_ALERTS: stale,
    };
  }
  expo() {
    const now = this.now; const mk = (o: Order) => ({ orderId: o.id, token: o.token, mode: o.mode, table: o.table ?? null, status: o.status, items: o.items.map(i => ({ id: i.id, name: i.name, qty: i.qty })), readyAt: o.readyAt ?? null, undoLeftMs: o.status === 'READY' && o.readyNotifyAt ? Math.max(0, o.readyNotifyAt - now) : null, arrived: o.arrived, customer: o.customer.name, packaging: o.mode !== 'DINE_IN' });
    const all = [...this.orders.values()];
    return { toPack: all.filter(o => ['ASSEMBLY', 'EXPO_CHECK'].includes(o.status)).map(mk), ready: all.filter(o => o.status === 'READY').map(mk) };
  }
  menuView() { return [...this.menu.values()].map(m => ({ ...m, available: this.inventory.portionsLeft(m, true) > 0, portionsLeft: this.inventory.portionsLeft(m, true) })); }
  stats() {
    const all = [...this.orders.values()]; const done = all.filter(o => o.readyAt && o.acceptedAt); const waits = done.filter(o => o.mode !== 'PREORDER').map(o => (o.readyAt! - o.createdAt) / MIN).sort((a, b) => a - b);
    const pct = (p: number) => (waits.length ? +waits[Math.min(waits.length - 1, Math.round(p * (waits.length - 1)))].toFixed(1) : 0);
    const byStatus: Record<string, number> = {}; for (const o of all) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    return { orders: all.length, byStatus, revenue: all.filter(o => o.paid && !['CANCELLED', 'REFUNDED'].includes(o.status)).reduce((s, o) => s + o.total, 0), presentWaitP50: pct(0.5), presentWaitP90: pct(0.9), policy: this.policy, unitsOnline: this.unitsOnline };
  }
  snapshot() { return { orders: [...this.orders.values()], tasks: [...this.tasks.values()], events: this.events, notifications: this.notifications, inventory: this.inventory.snapshot(), tokens: this.tokens.snapshot(), seq: this.seq, idem: [...this.idem], paymentEvents: [...this.paymentEvents], reserved: [...this.reserved].map(([k, v]) => [k, [...v]]), sentReady: [...this.sentReady], unitsOnline: this.unitsOnline, businessDay: this.businessDay }; }
  restore(s: ReturnType<Engine['snapshot']>) {
    this.orders = new Map(s.orders.map(o => [o.id, o])); this.tasks = new Map(s.tasks.map(t => [t.id, t])); this.events = s.events; this.notifications = s.notifications; this.inventory.restore(s.inventory);
    this.tokens = new TokenIssuer(s.tokens); this.seq = s.seq; this.idem = new Map(s.idem as [string, { orderId: string }][]); this.paymentEvents = new Set(s.paymentEvents); this.reserved = new Map((s.reserved as [string, [string, number][]][]).map(([k, v]) => [k, new Map(v)])); this.sentReady = new Set(s.sentReady); this.unitsOnline = s.unitsOnline; this.businessDay = s.businessDay; this.dirty = true;
  }
  closeDay() { this.tokens.reset(); this.businessDay = this.dayKey(); }
}
