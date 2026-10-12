import { MIN, type MenuItem, type Order, type Policy, type StationDef, type StationId, type Task } from '../types.ts';
import type { Settings } from '../config/menu.ts';

export interface PlanInput {
  now: number; policy: Policy; settings: Settings;
  tasks: Task[];                       // all non-terminal tasks (PLANNED/READY/RELEASED/COOKING/DONE of live orders)
  orders: Map<string, Order>;
  menu: Map<string, MenuItem>;
  stations: Map<StationId, StationDef>;
  unitsOnline: Record<string, number>; // units in service per station
  immediate?: Set<string>;             // order ids to treat as "present" (used for feasibility quotes)
}
export interface TaskPlan { start: number; finish: number; unit: number; batchId: string }
export interface OrderPlan { cookDone: number; packStart: number; readyAt: number }
export interface PlanResult { tasks: Map<string, TaskPlan>; orders: Map<string, OrderPlan> }

const isPresent = (o: Order, immediate?: Set<string>) => o.mode !== 'PREORDER' || o.arrived || !!immediate?.has(o.id);
export const weightOf = (o: Order, s: Settings) => (o.mode === 'PREORDER' ? (o.arrived ? s.weights.PREORDER_ARRIVED : s.weights.PREORDER) : s.weights[o.mode]);

/** Pure planner: given the whole kitchen state, returns when/where each unstarted task should run. */
export function plan(inp: PlanInput): PlanResult {
  const { now, policy, settings: S } = inp;
  const out: PlanResult = { tasks: new Map(), orders: new Map() };
  const free: Record<string, number[]> = {};
  for (const [sid, st] of inp.stations) { if (sid === 'pack') continue; free[sid] = Array.from({ length: Math.max(0, inp.unitsOnline[sid] ?? st.units) }, () => now); }
  // running tasks occupy their unit until expected finish (or now if overdue)
  const running = inp.tasks.filter(t => t.status === 'COOKING' && t.station !== 'pack');
  for (const t of running) {
    const m = inp.menu.get(t.itemId)!; const end = Math.max(now, (t.actualStart ?? now) + m.cookMin * MIN);
    const f = free[t.station]; if (!f?.length) continue;
    const u = t.unit != null && t.unit < f.length ? t.unit : f.indexOf(Math.min(...f));
    f[u] = Math.max(f[u], end);
  }
  const pending = inp.tasks.filter(t => ['PLANNED', 'READY', 'RELEASED'].includes(t.status));
  type P = { t: Task; o: Order; m: MenuItem; rel: number; D: number; w: number; dur: number };
  const ps: P[] = [];
  for (const t of pending) {
    const o = inp.orders.get(t.orderId); const m = inp.menu.get(t.itemId); if (!o || !m) continue;
    const dur = m.cookMin * MIN; const present = isPresent(o, inp.immediate) || policy !== 'smart';
    const base = Math.max(now, o.acceptedAt ?? o.createdAt);
    let rel = base;
    if (!present) rel = Math.max(base, o.deadline - S.packMin * MIN - dur - S.holdFactor * m.holdMin * MIN - S.preorderBufferMin * MIN);
    ps.push({ t, o, m, rel, D: o.deadline, w: weightOf(o, S), dur });
  }
  const byStation = new Map<string, P[]>();
  for (const p of ps) { (byStation.get(p.t.station) ?? byStation.set(p.t.station, []).get(p.t.station)!).push(p); }
  const slackAt = (p: P, t: number) => p.D - S.packMin * MIN - p.dur - t;
  let batchSeq = 0;
  for (const [sid, list] of byStation) {
    const f = free[sid]; let pend = list.slice();
    if (!f || f.length === 0) { // station fully offline: tasks stay unplanned (BLOCKED) – no plan entries
      continue;
    }
    while (pend.length) {
      let u = 0; for (let i = 1; i < f.length; i++) if (f[i] < f[u]) u = i;
      let t = f[u];
      let avail = pend.filter(p => p.rel <= t);
      if (!avail.length) { t = Math.min(...pend.map(p => p.rel)); avail = pend.filter(p => p.rel <= t); }
      const age = (p: P) => now - p.o.createdAt;
      const quotedSpan = (p: P) => ((p.o.promisedP80 ?? p.o.deadline) - p.o.createdAt) + S.fairnessExtraMin * MIN;
      const key = (p: P): [number, number, number, number] => {
        if (policy === 'fifo') return [0, 0, p.o.createdAt, 0];
        const starving = policy === 'smart' && age(p) > quotedSpan(p) ? 0 : 1; // fairness guard
        return [starving, slackAt(p, t), -p.w, p.o.createdAt];
      };
      avail.sort((a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return a.t.id < b.t.id ? -1 : 1; });
      const lead = avail[0]; const cap = lead.m.batchCap;
      const batch = avail.filter(p => p.t.itemId === lead.t.itemId).slice(0, cap);
      let start = t;
      if (policy !== 'fifo' && batch.length < cap) { // batching window: wait briefly for a same-item partner if nobody is hurt
        const win = S.batchWindowMin * MIN;
        const extras = pend.filter(p => p.t.itemId === lead.t.itemId && p.rel > t && p.rel <= t + win).sort((a, b) => a.rel - b.rel);
        for (const x of extras) {
          if (batch.length >= cap) break;
          const ns = Math.max(start, x.rel);
          if ([...batch, x].every(p => slackAt(p, ns) >= 0)) { batch.push(x); start = ns; }
        }
      }
      const finish = start + lead.dur; const bid = 'b' + (++batchSeq);
      for (const p of batch) { out.tasks.set(p.t.id, { start, finish, unit: u, batchId: bid }); }
      f[u] = finish; pend = pend.filter(p => !batch.includes(p));
    }
  }
  // order level: cook done -> pack (2 units, 1 min) -> ready
  const live = new Map<string, Task[]>();
  for (const t of inp.tasks) if (!['CANCELLED', 'FAILED'].includes(t.status)) (live.get(t.orderId) ?? live.set(t.orderId, []).get(t.orderId)!).push(t);
  const cooks: { id: string; cookDone: number; created: number }[] = [];
  for (const [oid, ts] of live) {
    const o = inp.orders.get(oid); if (!o || ['READY', 'HANDED_OVER', 'COMPLETED'].includes(o.status)) continue;
    let done = now; let unplanned = false;
    for (const t of ts) {
      if (t.status === 'DONE') done = Math.max(done, t.actualFinish ?? now);
      else if (t.status === 'COOKING') { const m = inp.menu.get(t.itemId)!; done = Math.max(done, (t.actualStart ?? now) + m.cookMin * MIN); }
      else { const pl = out.tasks.get(t.id); if (pl) done = Math.max(done, pl.finish); else unplanned = true; }
    }
    if (unplanned) continue;
    cooks.push({ id: oid, cookDone: done, created: o.createdAt });
  }
  const packUnits = Array.from({ length: Math.max(1, inp.unitsOnline['pack'] ?? 2) }, () => now);
  cooks.sort((a, b) => a.cookDone - b.cookDone || a.created - b.created);
  for (const c of cooks) {
    let u = 0; for (let i = 1; i < packUnits.length; i++) if (packUnits[i] < packUnits[u]) u = i;
    const ps_ = Math.max(c.cookDone, packUnits[u]); packUnits[u] = ps_ + S.packMin * MIN;
    out.orders.set(c.id, { cookDone: c.cookDone, packStart: ps_, readyAt: ps_ + S.packMin * MIN });
  }
  return out;
}
