// Deterministic replay: runs the real Engine on a virtual clock with an "obedient kitchen" (starts tasks when released, finishes on time).
import { Engine, MIN, MENU, type CreateOrderInput, type Policy } from '@queuebite/core';
export interface SimOrder { atMin: number; input: CreateOrderInput; label?: string; arriveAtMin?: number }
export interface SimResult { policy: Policy; rows: Row[]; admitted: number; rejected: number; metrics: Metrics; engine: Engine }
export interface Row { label: string; mode: string; token: string; placedMin: number; readyMin: number | null; waitMin: number | null; deadlineMin: number; idleMin: number | null; maxHoldMin: number; holdViolations: number; rejected?: string }
export interface Metrics { presentMean: number; presentP50: number; presentP90: number; preorderIdleAvg: number; preorderLate: number; holdViolations: number; avgHold: number; lastReadyMin: number }
export class ManualClock { t: number; constructor(t = Date.UTC(2026, 9, 10, 7, 30)) { this.t = t; } now() { return this.t; } set(t: number) { this.t = t; } }

export function replay(orders: SimOrder[], policy: Policy, opts: { stepSec?: number; setup?: (e: Engine) => void; maxMin?: number } = {}): SimResult {
  const clock = new ManualClock(); const t0 = clock.now(); const e = new Engine({ clock, policy }); opts.setup?.(e);
  const step = (opts.stepSec ?? 5) * 1000; const pending = [...orders].sort((a, b) => a.atMin - b.atMin);
  const ids = new Map<string, { o: SimOrder; id?: string; rejected?: string }>(); const placed: { o: SimOrder; id?: string; rejected?: string }[] = [];
  const horizon = (opts.maxMin ?? 180) * MIN; let i = 0; const arrivals: { at: number; id: string }[] = [];
  for (; clock.now() - t0 <= horizon; clock.set(clock.now() + step)) {
    while (i < pending.length && t0 + pending[i].atMin * MIN <= clock.now()) {
      const so = pending[i++]; const rec: { o: SimOrder; id?: string; rejected?: string } = { o: so };
      try { const { order } = e.createOrder(so.input, `sim-${i}`); rec.id = order.id; if (order.status === 'PLACED') { if (order.paymentMode === 'PREPAID') e.confirmPayment(`pay-${i}`, order.id, order.total); else e.accept(order.id); } if (so.arriveAtMin != null) arrivals.push({ at: t0 + so.arriveAtMin * MIN, id: order.id }); }
      catch (err: any) { rec.rejected = err.code ?? String(err); }
      placed.push(rec); if (rec.id) ids.set(rec.id, rec);
    }
    for (const a of arrivals) if (a.at <= clock.now()) { try { e.arrived(a.id); } catch { /* order already finished */ } }
    e.tick();
    for (const t of [...e.tasks.values()]) { if (t.status === 'RELEASED' && (t.plannedStart ?? 0) <= clock.now()) { try { e.startTask(t.id); } catch { /* already started with batch */ } } }
    for (const t of [...e.tasks.values()]) { if (t.status === 'COOKING' && clock.now() >= t.actualStart! + e.menu.get(t.itemId)!.cookMin * MIN) e.doneTask(t.id); }
    // Expo: ready when the plan's pack slot arrives
    for (const o of e.orders.values()) if (o.status === 'ASSEMBLY') { const op = e.lastPlan.orders.get(o.id); if (!op || clock.now() >= (op.packStart ?? 0) + 0) e.markReady(o.id, o.items.map(x => x.id)); }
    for (const o of e.orders.values()) if (o.status === 'READY' && (o.mode !== 'PREORDER' || clock.now() >= o.deadline)) e.handover(o.id, o.token);
    if (i >= pending.length && [...e.orders.values()].every(o => ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(o.status))) break;
  }
  const rows: Row[] = [];
  for (const r of placed) {
    if (r.rejected || !r.id) { rows.push({ label: r.o.label ?? '?', mode: r.o.input.mode, token: '-', placedMin: r.o.atMin, readyMin: null, waitMin: null, deadlineMin: 0, idleMin: null, maxHoldMin: 0, holdViolations: 0, rejected: r.rejected }); continue; }
    const o = e.get(r.id); const ts = [...e.tasks.values()].filter(t => t.orderId === o.id && t.status === 'DONE');
    const lastFin = Math.max(0, ...ts.map(t => t.actualFinish!)); const holds = ts.map(t => (lastFin - t.actualFinish!) / MIN); let viol = 0;
    ts.forEach((t, k) => { if (holds[k] > e.menu.get(t.itemId)!.holdMin) viol++; });
    const readyMin = o.readyAt ? (o.readyAt - t0) / MIN : null;
    rows.push({ label: r.o.label ?? o.token, mode: o.mode, token: o.token, placedMin: r.o.atMin, readyMin, waitMin: readyMin != null ? readyMin - r.o.atMin : null, deadlineMin: (o.deadline - t0) / MIN,
      idleMin: o.mode === 'PREORDER' && readyMin != null ? Math.max(0, (o.deadline - t0) / MIN - readyMin) : null, maxHoldMin: Math.max(0, ...holds), holdViolations: viol });
  }
  const done = rows.filter(r => !r.rejected && r.readyMin != null); const present = done.filter(r => r.mode !== 'PREORDER').map(r => r.waitMin!).sort((a, b) => a - b); const pre = done.filter(r => r.mode === 'PREORDER');
  const pct = (a: number[], p: number) => { if (!a.length) return 0; const x = p * (a.length - 1), lo = Math.floor(x), hi = Math.ceil(x); return a[lo] + (a[hi] - a[lo]) * (x - lo); };
  const metrics: Metrics = { presentMean: present.length ? +(present.reduce((s, v) => s + v, 0) / present.length).toFixed(1) : 0, presentP50: +pct(present, .5).toFixed(1), presentP90: +pct(present, .9).toFixed(1), preorderIdleAvg: pre.length ? +(pre.reduce((s, r) => s + (r.idleMin ?? 0), 0) / pre.length).toFixed(1) : 0,
    preorderLate: pre.filter(r => r.readyMin! > r.deadlineMin + 0.1).length, holdViolations: done.reduce((s, r) => s + r.holdViolations, 0), avgHold: done.length ? +(done.reduce((s, r) => s + r.maxHoldMin, 0) / done.length).toFixed(2) : 0, lastReadyMin: Math.max(0, ...done.map(r => r.readyMin!)) };
  return { policy, rows, admitted: done.length, rejected: rows.length - done.length, metrics, engine: e };
}
export const menuIds = MENU.map(m => m.id);
