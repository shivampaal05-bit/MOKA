// packages/core/src/types.ts
var MIN = 6e4;
var DomainError = class extends Error {
  code;
  status;
  details;
  constructor(code, message, status = 422, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
};

// packages/core/src/config/menu.ts
var STATIONS = [
  { id: "grill", name: "Grill", units: 2 },
  { id: "fryer", name: "Fryer", units: 2 },
  { id: "wok", name: "Wok", units: 2 },
  { id: "bev", name: "Beverage", units: 2 },
  { id: "cold", name: "Cold / Chaat", units: 1 },
  { id: "pack", name: "Pack & Expo", units: 2 }
];
var MENU = [
  {
    id: "burger",
    name: "Burger",
    price: 99,
    station: "grill",
    cookMin: 4,
    batchCap: 4,
    holdMin: 8,
    emoji: "\u{1F354}",
    recipe: [{ ingredient: "bun", qty: 1 }, { ingredient: "patty", qty: 1 }, { ingredient: "cheese", qty: 1 }, { ingredient: "sauce_g", qty: 20 }, { ingredient: "burger_box", qty: 1, pack: true }]
  },
  {
    id: "fries",
    name: "French fries",
    price: 79,
    station: "fryer",
    cookMin: 5,
    batchCap: 2,
    holdMin: 4,
    emoji: "\u{1F35F}",
    recipe: [{ ingredient: "potato_g", qty: 150 }, { ingredient: "oil_ml", qty: 8 }, { ingredient: "salt_g", qty: 1 }, { ingredient: "fries_carton", qty: 1, pack: true }]
  },
  {
    id: "chilli_potato",
    name: "Chilli potato",
    price: 129,
    station: "wok",
    cookMin: 6,
    batchCap: 2,
    holdMin: 10,
    emoji: "\u{1F336}\uFE0F",
    recipe: [{ ingredient: "potato_g", qty: 150 }, { ingredient: "veg_g", qty: 30 }, { ingredient: "sauce_g", qty: 25 }, { ingredient: "oil_ml", qty: 10 }, { ingredient: "container", qty: 1, pack: true }]
  },
  {
    id: "chowmein",
    name: "Chowmein (main course)",
    price: 139,
    station: "wok",
    cookMin: 7,
    batchCap: 1,
    holdMin: 10,
    emoji: "\u{1F35C}",
    recipe: [{ ingredient: "noodles_g", qty: 200 }, { ingredient: "veg_g", qty: 60 }, { ingredient: "sauce_g", qty: 20 }, { ingredient: "oil_ml", qty: 10 }, { ingredient: "container", qty: 1, pack: true }]
  },
  {
    id: "chaat",
    name: "Chaat",
    price: 69,
    station: "cold",
    cookMin: 3,
    batchCap: 2,
    holdMin: 15,
    emoji: "\u{1F957}",
    recipe: [{ ingredient: "chaat_mix_g", qty: 80 }, { ingredient: "curd_g", qty: 40 }, { ingredient: "container", qty: 1, pack: true }]
  },
  {
    id: "chai",
    name: "Chai",
    price: 25,
    station: "bev",
    cookMin: 4,
    batchCap: 4,
    holdMin: 15,
    emoji: "\u{1F375}",
    recipe: [{ ingredient: "milk_ml", qty: 80 }, { ingredient: "tea_g", qty: 3 }, { ingredient: "sugar_g", qty: 8 }, { ingredient: "cup", qty: 1, pack: true }, { ingredient: "lid", qty: 1, pack: true }]
  },
  {
    id: "coffee",
    name: "Hot coffee",
    price: 60,
    station: "bev",
    cookMin: 4,
    batchCap: 4,
    holdMin: 10,
    emoji: "\u2615",
    recipe: [{ ingredient: "milk_ml", qty: 100 }, { ingredient: "coffee_g", qty: 6 }, { ingredient: "sugar_g", qty: 8 }, { ingredient: "cup", qty: 1, pack: true }, { ingredient: "lid", qty: 1, pack: true }]
  },
  {
    id: "cold_drink",
    name: "Cold drink",
    price: 40,
    station: "bev",
    cookMin: 1,
    batchCap: 6,
    holdMin: 30,
    emoji: "\u{1F964}",
    recipe: [{ ingredient: "cola_can", qty: 1 }]
  }
];
var ing = (id, name, unit, onHand, reorderLevel) => ({ id, name, unit, onHand, reserved: 0, reorderLevel });
var INGREDIENTS = [
  ing("bun", "Burger bun", "pc", 40, 10),
  ing("patty", "Patty", "pc", 40, 10),
  ing("cheese", "Cheese slice", "pc", 40, 10),
  ing("sauce_g", "Sauce", "g", 3e3, 500),
  ing("potato_g", "Potato", "g", 12e3, 2e3),
  ing("oil_ml", "Frying oil", "ml", 4e3, 800),
  ing("salt_g", "Salt", "g", 500, 100),
  ing("veg_g", "Vegetables", "g", 4e3, 800),
  ing("noodles_g", "Noodles", "g", 4e3, 800),
  ing("chaat_mix_g", "Chaat mix", "g", 2e3, 400),
  ing("curd_g", "Curd", "g", 2e3, 400),
  ing("milk_ml", "Milk", "ml", 6e3, 1e3),
  ing("tea_g", "Tea", "g", 300, 60),
  ing("coffee_g", "Coffee", "g", 300, 60),
  ing("sugar_g", "Sugar", "g", 1500, 300),
  ing("cola_can", "Cold drink can", "pc", 48, 12),
  ing("burger_box", "Burger box", "pc", 60, 15),
  ing("fries_carton", "Fries carton", "pc", 60, 15),
  ing("container", "Container", "pc", 60, 15),
  ing("cup", "Cup", "pc", 100, 20),
  ing("lid", "Lid", "pc", 100, 20)
];
var SETTINGS = {
  packMin: 1,
  preorderBufferMin: 3,
  holdFactor: 0.25,
  batchWindowMin: 2,
  maxWaitMin: 30,
  preorderMaxAheadMin: 120,
  etaHysteresisMin: 3,
  maxDelayNotices: 2,
  paymentHoldMin: 10,
  noShowGraceMin: 20,
  readyUndoSec: 20,
  fairnessExtraMin: 2,
  slotStepMin: 5,
  weights: { TAKEAWAY: 2, DINE_IN: 1, PREORDER: 1, PREORDER_ARRIVED: 2 },
  // travel slow case: 2 min + 4 min per km (starting rule; replace with measured data)
  travelBaseMin: 2,
  travelPerKmMin: 4
};

// packages/core/src/orders/state-machine.ts
var TRANSITIONS = {
  PLACED: ["PAID", "ACCEPTED", "CANCELLED", "EXPIRED"],
  PAID: ["ACCEPTED", "CANCELLED", "REFUND_PENDING"],
  ACCEPTED: ["SCHEDULED", "CANCELLED", "FAILED"],
  SCHEDULED: ["COOKING", "CANCELLED", "FAILED"],
  COOKING: ["ASSEMBLY", "CANCELLED", "FAILED"],
  ASSEMBLY: ["EXPO_CHECK", "COOKING", "CANCELLED", "FAILED"],
  EXPO_CHECK: ["READY", "COOKING", "CANCELLED", "FAILED"],
  READY: ["HANDED_OVER", "EXPO_CHECK", "NO_SHOW"],
  HANDED_OVER: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["REFUND_PENDING"],
  EXPIRED: ["REFUND_PENDING"],
  NO_SHOW: ["REFUND_PENDING"],
  FAILED: ["REFUND_PENDING"],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: []
};
function canTransition(from, to) {
  return TRANSITIONS[from].includes(to);
}
function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new DomainError("INVALID_TRANSITION", `Cannot move order from ${from} to ${to}`, 409, { from, to });
}

// packages/core/src/orders/tokens.ts
var PREFIX = { PREORDER: "P", DINE_IN: "T", TAKEAWAY: "W" };
var TokenIssuer = class {
  seq = {};
  constructor(snapshot) {
    if (snapshot) this.seq = { ...snapshot };
  }
  next(mode, deviceSeries) {
    const p = PREFIX[mode] + (deviceSeries ? "-" + deviceSeries : "");
    const n = this.seq[p] = (this.seq[p] ?? 0) + 1;
    return `${PREFIX[mode]}-${deviceSeries ?? ""}${String(n).padStart(deviceSeries ? 2 : 3, "0")}`;
  }
  reset() {
    this.seq = {};
  }
  snapshot() {
    return { ...this.seq };
  }
};

// packages/core/src/inventory/ledger.ts
function needsFor(menu, lines, packaging) {
  const n = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const m = menu.get(l.menuItemId);
    if (!m) throw new DomainError("UNKNOWN_ITEM", `Unknown item ${l.menuItemId}`, 400);
    for (const r of m.recipe) {
      if (r.pack && !packaging) continue;
      n.set(r.ingredient, (n.get(r.ingredient) ?? 0) + r.qty * l.qty);
    }
  }
  return n;
}
var Inventory = class {
  items = /* @__PURE__ */ new Map();
  ledger = [];
  seq = 0;
  clock;
  constructor(seed, clock) {
    this.clock = clock;
    for (const i of seed) this.items.set(i.id, { ...i });
  }
  available(id) {
    const i = this.items.get(id);
    return i ? i.onHand - i.reserved : 0;
  }
  log(ingredient, type, qty, ref, note) {
    this.ledger.push({ id: ++this.seq, at: this.clock.now(), ingredient, type, qty, ref, note });
  }
  reserve(needs, ref) {
    const ids = [...needs.keys()].sort();
    const short = {};
    for (const id of ids) {
      const need = needs.get(id);
      const av = this.available(id);
      if (av < need) short[id] = { need, available: av };
    }
    if (Object.keys(short).length) throw new DomainError("STOCK_SHORT", "Not enough stock for this order", 422, { short });
    for (const id of ids) {
      const q = needs.get(id);
      this.items.get(id).reserved += q;
      this.log(id, "RESERVE", q, ref);
    }
  }
  release(needs, ref) {
    for (const [id, q] of needs) {
      const i = this.items.get(id);
      i.reserved = Math.max(0, i.reserved - q);
      this.log(id, "RELEASE", q, ref);
    }
  }
  consume(needs, ref) {
    for (const [id, q] of needs) {
      const i = this.items.get(id);
      i.reserved = Math.max(0, i.reserved - q);
      i.onHand = Math.max(0, i.onHand - q);
      this.log(id, "CONSUME", q, ref);
    }
  }
  waste(id, qty, ref, note) {
    const i = this.items.get(id);
    if (!i) throw new DomainError("UNKNOWN_INGREDIENT", id, 400);
    this.log(id, "WASTE", qty, ref, note);
  }
  receipt(id, qty, note = "purchase received") {
    const i = this.items.get(id);
    if (!i) throw new DomainError("UNKNOWN_INGREDIENT", id, 400);
    if (qty <= 0) throw new DomainError("BAD_QTY", "qty must be > 0", 400);
    i.onHand += qty;
    this.log(id, "RECEIPT", qty, void 0, note);
  }
  adjust(id, counted, note = "physical count") {
    const i = this.items.get(id);
    if (!i) throw new DomainError("UNKNOWN_INGREDIENT", id, 400);
    const diff = counted - i.onHand;
    i.onHand = counted;
    this.log(id, "ADJUST", diff, void 0, note);
    return diff;
  }
  /** How many portions of a menu item can still be promised. */
  portionsLeft(m, packaging = true) {
    let best = Infinity;
    for (const r of m.recipe) {
      if (r.pack && !packaging) continue;
      best = Math.min(best, Math.floor(this.available(r.ingredient) / r.qty));
    }
    return best === Infinity ? 0 : best;
  }
  status(id) {
    const i = this.items.get(id);
    const a = i.onHand - i.reserved;
    if (a <= 0) return "FINISHED";
    if (a <= i.reorderLevel * 0.5) return "ORDER_NOW";
    if (a <= i.reorderLevel) return "LOW_SOON";
    return "OK";
  }
  snapshot() {
    return { items: [...this.items.values()], ledger: this.ledger, seq: this.seq };
  }
  restore(s) {
    this.items = new Map(s.items.map((i) => [i.id, i]));
    this.ledger = s.ledger;
    this.seq = s.seq;
  }
};

// packages/core/src/scheduler/plan.ts
var isPresent = (o, immediate) => o.mode !== "PREORDER" || o.arrived || !!immediate?.has(o.id);
var weightOf = (o, s) => o.mode === "PREORDER" ? o.arrived ? s.weights.PREORDER_ARRIVED : s.weights.PREORDER : s.weights[o.mode];
function plan(inp) {
  const { now, policy, settings: S } = inp;
  const out = { tasks: /* @__PURE__ */ new Map(), orders: /* @__PURE__ */ new Map() };
  const free = {};
  for (const [sid, st] of inp.stations) {
    if (sid === "pack") continue;
    free[sid] = Array.from({ length: Math.max(0, inp.unitsOnline[sid] ?? st.units) }, () => now);
  }
  const running = inp.tasks.filter((t) => t.status === "COOKING" && t.station !== "pack");
  for (const t of running) {
    const m = inp.menu.get(t.itemId);
    const end = Math.max(now, (t.actualStart ?? now) + m.cookMin * MIN);
    const f = free[t.station];
    if (!f?.length) continue;
    const u = t.unit != null && t.unit < f.length ? t.unit : f.indexOf(Math.min(...f));
    f[u] = Math.max(f[u], end);
  }
  const pending = inp.tasks.filter((t) => ["PLANNED", "READY", "RELEASED"].includes(t.status));
  const ps = [];
  for (const t of pending) {
    const o = inp.orders.get(t.orderId);
    const m = inp.menu.get(t.itemId);
    if (!o || !m) continue;
    const dur = m.cookMin * MIN;
    const present = isPresent(o, inp.immediate) || policy !== "smart";
    const base = Math.max(now, o.acceptedAt ?? o.createdAt);
    let rel = base;
    if (!present) rel = Math.max(base, o.deadline - S.packMin * MIN - dur - S.holdFactor * m.holdMin * MIN - S.preorderBufferMin * MIN);
    ps.push({ t, o, m, rel, D: o.deadline, w: weightOf(o, S), dur });
  }
  const byStation = /* @__PURE__ */ new Map();
  for (const p of ps) {
    (byStation.get(p.t.station) ?? byStation.set(p.t.station, []).get(p.t.station)).push(p);
  }
  const slackAt = (p, t) => p.D - S.packMin * MIN - p.dur - t;
  let batchSeq = 0;
  for (const [sid, list] of byStation) {
    const f = free[sid];
    let pend = list.slice();
    if (!f || f.length === 0) {
      continue;
    }
    while (pend.length) {
      let u = 0;
      for (let i = 1; i < f.length; i++) if (f[i] < f[u]) u = i;
      let t = f[u];
      let avail = pend.filter((p) => p.rel <= t);
      if (!avail.length) {
        t = Math.min(...pend.map((p) => p.rel));
        avail = pend.filter((p) => p.rel <= t);
      }
      const age = (p) => now - p.o.createdAt;
      const quotedSpan = (p) => (p.o.promisedP80 ?? p.o.deadline) - p.o.createdAt + S.fairnessExtraMin * MIN;
      const key = (p) => {
        if (policy === "fifo") return [0, 0, p.o.createdAt, 0];
        const starving = policy === "smart" && age(p) > quotedSpan(p) ? 0 : 1;
        return [starving, slackAt(p, t), -p.w, p.o.createdAt];
      };
      avail.sort((a, b) => {
        const ka = key(a), kb = key(b);
        for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
        return a.t.id < b.t.id ? -1 : 1;
      });
      const lead = avail[0];
      const cap = lead.m.batchCap;
      const batch = avail.filter((p) => p.t.itemId === lead.t.itemId).slice(0, cap);
      let start = t;
      if (policy !== "fifo" && batch.length < cap) {
        const win = S.batchWindowMin * MIN;
        const extras = pend.filter((p) => p.t.itemId === lead.t.itemId && p.rel > t && p.rel <= t + win).sort((a, b) => a.rel - b.rel);
        for (const x of extras) {
          if (batch.length >= cap) break;
          const ns = Math.max(start, x.rel);
          if ([...batch, x].every((p) => slackAt(p, ns) >= 0)) {
            batch.push(x);
            start = ns;
          }
        }
      }
      const finish = start + lead.dur;
      const bid = "b" + ++batchSeq;
      for (const p of batch) {
        out.tasks.set(p.t.id, { start, finish, unit: u, batchId: bid });
      }
      f[u] = finish;
      pend = pend.filter((p) => !batch.includes(p));
    }
  }
  const live = /* @__PURE__ */ new Map();
  for (const t of inp.tasks) if (!["CANCELLED", "FAILED"].includes(t.status)) (live.get(t.orderId) ?? live.set(t.orderId, []).get(t.orderId)).push(t);
  const cooks = [];
  for (const [oid, ts] of live) {
    const o = inp.orders.get(oid);
    if (!o || ["READY", "HANDED_OVER", "COMPLETED"].includes(o.status)) continue;
    let done = now;
    let unplanned = false;
    for (const t of ts) {
      if (t.status === "DONE") done = Math.max(done, t.actualFinish ?? now);
      else if (t.status === "COOKING") {
        const m = inp.menu.get(t.itemId);
        done = Math.max(done, (t.actualStart ?? now) + m.cookMin * MIN);
      } else {
        const pl = out.tasks.get(t.id);
        if (pl) done = Math.max(done, pl.finish);
        else unplanned = true;
      }
    }
    if (unplanned) continue;
    cooks.push({ id: oid, cookDone: done, created: o.createdAt });
  }
  const packUnits = Array.from({ length: Math.max(1, inp.unitsOnline["pack"] ?? 2) }, () => now);
  cooks.sort((a, b) => a.cookDone - b.cookDone || a.created - b.created);
  for (const c2 of cooks) {
    let u = 0;
    for (let i = 1; i < packUnits.length; i++) if (packUnits[i] < packUnits[u]) u = i;
    const ps_ = Math.max(c2.cookDone, packUnits[u]);
    packUnits[u] = ps_ + S.packMin * MIN;
    out.orders.set(c2.id, { cookDone: c2.cookDone, packStart: ps_, readyAt: ps_ + S.packMin * MIN });
  }
  return out;
}

// packages/core/src/scheduler/eta.ts
function makeQuote(p50, now, from) {
  const span = Math.max(0, p50 - now);
  const p80 = p50 + Math.max(1 * MIN, 0.2 * span);
  const p90 = p50 + Math.max(1.5 * MIN, 0.35 * span);
  const lo = Math.max(0, Math.ceil((p50 - from) / MIN));
  let hi = Math.ceil((p80 - from) / MIN);
  if (hi < lo + 2) hi = lo + 2;
  return { p50, p80, p90, lo, hi };
}
var ceilToStep = (t, stepMin) => Math.ceil(t / (stepMin * MIN)) * stepMin * MIN;

// packages/core/src/notifications/templates.ts
var ANIMATION = { ORDER_ACCEPTED: "accepted", ORDER_PREPARING: "preparing", ORDER_READY: "ready", DELAY_DETECTED: "delay" };
var hhmm = (ms) => new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
function render(ev, o, range, link, channel) {
  const tail = channel === "SMS" ? ` ${link}` : `
Track: ${link}`;
  switch (ev) {
    case "ORDER_ACCEPTED":
      return `Order confirmed. Token ${o.token}. Estimated ready: ${range.lo}\u2013${range.hi} min.${o.leaveAt ? ` Leave at ${hhmm(o.leaveAt)}.` : ""}${tail}`;
    case "ORDER_PREPARING":
      return `We're cooking your order ${o.token}. Ready in ${range.lo}\u2013${range.hi} min.${tail}`;
    case "ORDER_READY":
      return `Your order ${o.token} is ready. ${o.mode === "DINE_IN" ? "We are bringing it to your table." : "Collect it at the pickup counter with your token."}${tail}`;
    case "DELAY_DETECTED":
      return `Sorry, ${o.token} needs a little longer: now ${range.lo}\u2013${range.hi} min.${tail}`;
  }
}

// packages/core/src/engine.ts
var Engine = class {
  clock;
  policy;
  S;
  trackingBase;
  failWhatsapp;
  menu = new Map(MENU.map((m) => [m.id, m]));
  stations = new Map(STATIONS.map((s) => [s.id, s]));
  unitsOnline = Object.fromEntries(STATIONS.map((s) => [s.id, s.units]));
  orders = /* @__PURE__ */ new Map();
  tasks = /* @__PURE__ */ new Map();
  events = [];
  notifications = [];
  inventory;
  tokens = new TokenIssuer();
  idem = /* @__PURE__ */ new Map();
  paymentEvents = /* @__PURE__ */ new Set();
  reserved = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  seq = { order: 0, task: 0, item: 0, event: 0, notif: 0 };
  dirty = true;
  lastPlanAt = 0;
  lastPlan = { tasks: /* @__PURE__ */ new Map(), orders: /* @__PURE__ */ new Map() };
  businessDay;
  constructor(o) {
    this.clock = o.clock;
    this.policy = o.policy ?? "smart";
    this.S = o.settings ?? SETTINGS;
    this.trackingBase = o.trackingBase ?? "https://track.example/o";
    this.failWhatsapp = !!o.failWhatsapp;
    this.inventory = new Inventory(INGREDIENTS, o.clock);
    this.businessDay = this.dayKey();
  }
  dayKey() {
    return new Date(this.clock.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  }
  on(l) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(o, type, data) {
    const e = { id: ++this.seq.event, orderId: o.id, type, version: o.version, at: this.clock.now(), data };
    this.events.push(e);
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
      }
    }
    this.notifyFor(o, type);
  }
  bump(o) {
    o.version++;
  }
  setStatus(o, to) {
    assertTransition(o.status, to);
    o.status = to;
    this.bump(o);
  }
  get now() {
    return this.clock.now();
  }
  // ---------- planning ----------
  liveTasks() {
    return [...this.tasks.values()].filter((t) => {
      const o = this.orders.get(t.orderId);
      return o && ["ACCEPTED", "SCHEDULED", "COOKING", "ASSEMBLY", "EXPO_CHECK"].includes(o.status);
    });
  }
  runPlan(extraOrders, extraTasks, immediate) {
    const orders = new Map(this.orders);
    for (const o of extraOrders ?? []) orders.set(o.id, o);
    return plan({ now: this.now, policy: this.policy, settings: this.S, tasks: [...this.liveTasks(), ...extraTasks ?? []], orders, menu: this.menu, stations: this.stations, unitsOnline: this.unitsOnline, immediate });
  }
  /** Re-plan, apply start times, release due tasks, and keep customer promises honest (hysteresis). */
  replan() {
    const res = this.runPlan();
    this.lastPlan = res;
    this.lastPlanAt = this.now;
    this.dirty = false;
    for (const t of this.liveTasks()) {
      if (["PLANNED", "READY", "RELEASED"].includes(t.status)) {
        const p = res.tasks.get(t.id);
        if (!p) {
          if (t.status !== "PLANNED") t.status = "BLOCKED";
          continue;
        }
        t.plannedStart = p.start;
        t.plannedFinish = p.finish;
        t.unit = p.unit;
        t.batchId = p.batchId;
        t.status = p.start <= this.now ? "RELEASED" : "PLANNED";
      } else if (t.status === "BLOCKED") {
        t.status = "PLANNED";
      }
    }
    for (const [oid, op] of res.orders) {
      const o = this.orders.get(oid);
      o.plannedReadyAt = op.readyAt;
      if (o.promisedP50 != null && Math.abs(op.readyAt - o.promisedP50) >= this.S.etaHysteresisMin * MIN && !["READY", "HANDED_OVER"].includes(o.status)) {
        const later = op.readyAt > o.promisedP50;
        const q = makeQuote(op.readyAt, this.now, this.now);
        const slipped = o.mode !== "PREORDER" || op.readyAt > o.deadline + this.S.etaHysteresisMin * MIN || !later;
        if (slipped) {
          o.promisedP50 = q.p50;
          o.promisedP80 = q.p80;
          o.promisedP90 = q.p90;
          this.bump(o);
          this.emit(o, "ETA_UPDATED", { lo: q.lo, hi: q.hi, later });
        }
      }
    }
  }
  markDirty() {
    this.dirty = true;
  }
  // ---------- commands ----------
  createOrder(inp, idemKey) {
    if (idemKey && this.idem.has(idemKey)) return { order: this.orders.get(this.idem.get(idemKey).orderId), duplicate: true };
    if (!inp.items?.length) throw new DomainError("EMPTY_ORDER", "Order has no items", 400);
    if (!inp.customer?.name || !/^\+?\d{8,15}$/.test((inp.customer.phone ?? "").replace(/\s/g, ""))) throw new DomainError("BAD_CUSTOMER", "Name and valid phone are required", 400);
    if (inp.mode === "DINE_IN" && !inp.table) throw new DomainError("TABLE_REQUIRED", "Dine-in order needs a table", 400);
    const items = [];
    let total = 0;
    for (const l of inp.items) {
      const m = this.menu.get(l.menuItemId);
      if (!m) throw new DomainError("UNKNOWN_ITEM", `Unknown item ${l.menuItemId}`, 400);
      if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) throw new DomainError("BAD_QTY", "qty must be 1\u201320", 400);
      items.push({ id: `i${++this.seq.item}`, menuItemId: m.id, name: m.name, qty: l.qty, price: m.price });
      total += m.price * l.qty;
    }
    const packaging = inp.mode !== "DINE_IN";
    const needs = needsFor(this.menu, items, packaging);
    const paymentMode = inp.paymentMode ?? (inp.mode === "PREORDER" ? "PREPAID" : inp.mode === "TAKEAWAY" ? "COUNTER" : "TABLE_BILL");
    if (inp.mode === "PREORDER" && paymentMode !== "PREPAID") throw new DomainError("PREPAY_REQUIRED", "Pre-orders must be paid online first", 400);
    const now = this.now;
    const id = `o${++this.seq.order}`;
    const o = {
      id,
      token: "",
      channel: inp.channel,
      mode: inp.mode,
      status: "PLACED",
      version: 1,
      customer: inp.customer,
      table: inp.table,
      distanceKm: inp.distanceKm,
      items,
      total,
      paymentMode,
      paid: false,
      createdAt: now,
      acceptedAt: void 0,
      deadline: now,
      arrived: false,
      leaving: false,
      idempotencyKey: idemKey,
      businessDay: this.businessDay,
      refund: "NONE",
      refundAmount: 0,
      delayNotices: 0,
      accessKey: globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 20)
    };
    const tasks = this.makeTasks(o);
    const baseline = this.runPlan();
    const harmed = (res) => {
      const out = [];
      for (const [oid, op] of res.orders) {
        const ex = this.orders.get(oid);
        if (!ex || oid === o.id) continue;
        const before = baseline.orders.get(oid)?.readyAt;
        const limit = ex.mode === "PREORDER" ? ex.deadline + 2 * MIN : Math.max(ex.promisedP90 ?? 0, ex.deadline);
        if (op.readyAt > limit && (before == null || before <= limit)) out.push(ex.token || oid);
      }
      return out;
    };
    if (inp.mode === "PREORDER") {
      const km = inp.distanceKm ?? 1;
      const travel = (this.S.travelBaseMin + this.S.travelPerKmMin * km) * MIN;
      const probe0 = { ...o, acceptedAt: now };
      const earliest = this.runPlan([probe0], tasks, /* @__PURE__ */ new Set([o.id])).orders.get(o.id).readyAt;
      const floor = ceilToStep(Math.max(earliest, now + travel), this.S.slotStepMin);
      const want = inp.slotInMin != null ? ceilToStep(now + inp.slotInMin * MIN, this.S.slotStepMin) : floor;
      let slot = Math.max(want, floor);
      let found = false;
      for (; slot - now <= this.S.preorderMaxAheadMin * MIN; slot += this.S.slotStepMin * MIN) {
        const probe = { ...o, acceptedAt: now, deadline: slot, slotAt: slot };
        const res = this.runPlan([probe], tasks);
        if (res.orders.get(o.id).readyAt <= slot + 1 * MIN && harmed(res).length === 0) {
          found = true;
          break;
        }
      }
      if (!found) throw new DomainError("CAPACITY", "No pickup slot is available in the next two hours", 422);
      if (inp.slotInMin != null && slot > want) throw new DomainError("SLOT_UNAVAILABLE", "That pickup slot is not available", 422, { suggestedSlotInMin: Math.ceil((slot - now) / MIN) });
      o.slotAt = slot;
      o.deadline = slot;
    } else {
      const probe = { ...o, acceptedAt: now };
      const res = this.runPlan([probe], tasks, /* @__PURE__ */ new Set([o.id]));
      const earliest = res.orders.get(o.id).readyAt;
      const hurt = harmed(res);
      if (earliest - now > this.S.maxWaitMin * MIN || hurt.length) throw new DomainError("CAPACITY", "Kitchen is at capacity right now", 422, { wouldBeReadyInMin: Math.ceil((earliest - now) / MIN), wouldDelay: hurt });
      o.deadline = earliest;
    }
    this.inventory.reserve(needs, id);
    this.reserved.set(id, needs);
    o.token = "";
    this.orders.set(id, o);
    if (idemKey) this.idem.set(idemKey, { orderId: id });
    for (const t of tasks) this.tasks.set(t.id, t);
    if (paymentMode === "PREPAID") o.holdExpiresAt = now + this.S.paymentHoldMin * MIN;
    this.emit(o, "ORDER_PLACED", { total });
    if (paymentMode === "TABLE_BILL" || inp.mode === "DINE_IN") this.accept(o.id, inp.deviceSeries);
    return { order: o, duplicate: false };
  }
  makeTasks(o) {
    const ts = [];
    for (const it of o.items) {
      const m = this.menu.get(it.menuItemId);
      for (let k = 0; k < it.qty; k++) ts.push({ id: `t${++this.seq.task}`, orderId: o.id, orderItemId: it.id, itemId: m.id, station: m.station, status: "PLANNED", version: 1 });
    }
    return ts;
  }
  /** Cashier / waiter confirms a counter or table order (payment taken or table bill opened). */
  accept(orderId, deviceSeries) {
    const o = this.get(orderId);
    if (o.status !== "PLACED" && o.status !== "PAID") throw new DomainError("INVALID_TRANSITION", `Order is ${o.status}`, 409);
    if (o.paymentMode !== "TABLE_BILL") o.paid = true;
    if (o.status === "PLACED" && o.paymentMode === "PREPAID") throw new DomainError("PAYMENT_REQUIRED", "Prepaid order is not paid yet", 409);
    o.token = this.tokens.next(o.mode, deviceSeries);
    o.acceptedAt = this.now;
    o.holdExpiresAt = void 0;
    this.setStatus(o, "ACCEPTED");
    this.setStatus(o, "SCHEDULED");
    const km = o.distanceKm ?? 1;
    this.replanQuiet();
    const op = this.lastPlan.orders.get(o.id);
    const ready = op?.readyAt ?? o.deadline;
    const q = makeQuote(ready, this.now, this.now);
    o.promisedP50 = q.p50;
    o.promisedP80 = q.p80;
    o.promisedP90 = q.p90;
    if (o.mode === "PREORDER") {
      const slow = (this.S.travelBaseMin + this.S.travelPerKmMin * km) * MIN;
      o.leaveAt = Math.max(this.now, ready - slow);
    }
    this.emit(o, "ORDER_ACCEPTED", { lo: q.lo, hi: q.hi, token: o.token });
    this.markDirty();
    return o;
  }
  replanQuiet() {
    const res = this.runPlan();
    this.lastPlan = res;
    for (const t of this.liveTasks()) {
      const p = res.tasks.get(t.id);
      if (p && ["PLANNED", "READY", "RELEASED"].includes(t.status)) {
        t.plannedStart = p.start;
        t.plannedFinish = p.finish;
        t.unit = p.unit;
        t.batchId = p.batchId;
      }
    }
  }
  /** Payment gateway webhook. Idempotent on providerEventId; amount is verified against the server-side total. */
  confirmPayment(providerEventId, orderId, amount) {
    if (this.paymentEvents.has(providerEventId)) return { duplicate: true, order: this.get(orderId) };
    const o = this.get(orderId);
    this.paymentEvents.add(providerEventId);
    if (amount !== o.total) throw new DomainError("AMOUNT_MISMATCH", "Paid amount does not match the order total", 422, { expected: o.total, got: amount });
    if (o.status === "EXPIRED" || o.status === "CANCELLED") {
      o.refund = "REFUND_PENDING";
      o.refundAmount = amount;
      this.emit(o, "REFUND_PENDING", { reason: "paid after " + o.status });
      return { duplicate: false, order: o };
    }
    if (o.status !== "PLACED") return { duplicate: true, order: o };
    o.paid = true;
    this.setStatus(o, "PAID");
    this.emit(o, "PAYMENT_CONFIRMED", { amount });
    this.accept(o.id);
    return { duplicate: false, order: o };
  }
  startTask(taskId, force = false) {
    const t = this.getTask(taskId);
    const o = this.get(t.orderId);
    if (t.status === "COOKING") return t;
    if (!force && t.status !== "RELEASED") throw new DomainError("NOT_RELEASED", `Task is ${t.status}; the scheduler has not released it yet`, 409);
    const batch = t.batchId ? [...this.tasks.values()].filter((x) => x.batchId === t.batchId && x.status === "RELEASED" && x.station === t.station && x.itemId === t.itemId) : [t];
    const all = batch.includes(t) ? batch : [t, ...batch];
    for (const x of all.slice(0, this.menu.get(t.itemId).batchCap)) {
      const xo = this.get(x.orderId);
      x.status = "COOKING";
      x.actualStart = this.now;
      x.version++;
      const m = this.menu.get(x.itemId);
      const part = this.portionNeeds(x, m);
      this.inventory.consume(part, x.id);
      if (xo.status === "SCHEDULED") {
        this.setStatus(xo, "COOKING");
        this.emit(xo, "ORDER_PREPARING", {});
      } else if (xo.status === "ASSEMBLY" || xo.status === "EXPO_CHECK") {
        this.setStatus(xo, "COOKING");
      }
      this.emit(xo, "COOK_STARTED", { task: x.id, item: m.name });
    }
    void o;
    this.markDirty();
    return t;
  }
  portionNeeds(t, m) {
    const n = /* @__PURE__ */ new Map();
    for (const r of m.recipe) if (!r.pack) n.set(r.ingredient, r.qty);
    return n;
  }
  doneTask(taskId) {
    const t = this.getTask(taskId);
    if (t.status === "DONE") return t;
    if (t.status !== "COOKING") throw new DomainError("NOT_COOKING", `Task is ${t.status}`, 409);
    const batch = t.batchId ? [...this.tasks.values()].filter((x) => x.batchId === t.batchId && x.status === "COOKING" && x.itemId === t.itemId) : [t];
    for (const x of batch.includes(t) ? batch : [t, ...batch]) {
      x.status = "DONE";
      x.actualFinish = this.now;
      x.version++;
      this.afterTaskDone(x);
    }
    this.markDirty();
    return t;
  }
  afterTaskDone(t) {
    const o = this.get(t.orderId);
    const mine = [...this.tasks.values()].filter((x) => x.orderId === o.id && !["CANCELLED", "FAILED"].includes(x.status));
    if (mine.every((x) => x.status === "DONE") && o.status === "COOKING") {
      this.setStatus(o, "ASSEMBLY");
      this.emit(o, "ASSEMBLY_STARTED", {});
    }
  }
  /** Food dropped / burnt: portions go to WASTE and a replacement task is created (re-fire). */
  failTask(taskId, reason = "dropped") {
    const t = this.getTask(taskId);
    const o = this.get(t.orderId);
    const m = this.menu.get(t.itemId);
    if (!["COOKING", "DONE"].includes(t.status)) throw new DomainError("NOT_STARTED", "Only started tasks can fail", 409);
    t.status = "FAILED";
    t.version++;
    for (const r of m.recipe) if (!r.pack) this.inventory.waste(r.ingredient, r.qty, t.id, reason);
    const need = /* @__PURE__ */ new Map();
    for (const r of m.recipe) if (!r.pack) need.set(r.ingredient, r.qty);
    this.inventory.reserve(need, t.id);
    const nt = { id: `t${++this.seq.task}`, orderId: o.id, orderItemId: t.orderItemId, itemId: t.itemId, station: t.station, status: "PLANNED", version: 1, replacementOf: t.id };
    this.tasks.set(nt.id, nt);
    if (["ASSEMBLY", "EXPO_CHECK"].includes(o.status)) this.setStatus(o, "COOKING");
    this.emit(o, "TASK_FAILED", { task: t.id, reason, replacement: nt.id });
    this.markDirty();
    this.replan();
    return nt;
  }
  setUnits(station, units) {
    const st = this.stations.get(station);
    if (!st) throw new DomainError("UNKNOWN_STATION", station, 400);
    this.unitsOnline[station] = Math.max(0, Math.min(units, st.units));
    this.markDirty();
    this.replan();
    for (const o of this.orders.values()) if (o.status === "SCHEDULED" || o.status === "COOKING") this.emit(o, "RESOURCE_CHANGED", { station, units: this.unitsOnline[station] });
  }
  /** Expo: every item must be present. READY is a human tap; the customer message is held for the undo window. */
  markReady(orderId, checked) {
    const o = this.get(orderId);
    if (o.status === "READY") return o;
    if (!["ASSEMBLY", "EXPO_CHECK"].includes(o.status)) throw new DomainError("NOT_READY_FOR_EXPO", `Order is ${o.status}; not all tasks are done`, 409);
    const need = o.items.map((i) => i.id);
    const missing = need.filter((id) => !checked.includes(id));
    if (missing.length) throw new DomainError("EXPO_ITEMS_MISSING", "Every item must be checked before READY", 422, { missing });
    if (o.status === "ASSEMBLY") this.setStatus(o, "EXPO_CHECK");
    const pk = /* @__PURE__ */ new Map();
    const full = this.reserved.get(o.id);
    for (const it of o.items) {
      const m = this.menu.get(it.menuItemId);
      for (const r of m.recipe) if (r.pack && o.mode !== "DINE_IN") pk.set(r.ingredient, (pk.get(r.ingredient) ?? 0) + r.qty * it.qty);
    }
    void full;
    if (pk.size) this.inventory.consume(pk, o.id);
    this.setStatus(o, "READY");
    o.readyAt = this.now;
    o.readyNotifyAt = this.now + this.S.readyUndoSec * 1e3;
    this.emit(o, "ORDER_READY", {});
    this.markDirty();
    return o;
  }
  undoReady(orderId) {
    const o = this.get(orderId);
    if (o.status !== "READY") throw new DomainError("INVALID_TRANSITION", "Order is not READY", 409);
    if (o.readyNotifyAt != null && this.now >= o.readyNotifyAt) throw new DomainError("UNDO_WINDOW_PASSED", "The customer was already notified", 409);
    this.setStatus(o, "EXPO_CHECK");
    o.readyAt = void 0;
    o.readyNotifyAt = void 0;
    this.emit(o, "READY_UNDONE", {});
    return o;
  }
  arrived(orderId) {
    const o = this.get(orderId);
    if (!["ACCEPTED", "SCHEDULED", "COOKING", "ASSEMBLY", "EXPO_CHECK", "READY"].includes(o.status)) throw new DomainError("INVALID_TRANSITION", `Order is ${o.status}`, 409);
    if (!o.arrived) {
      o.arrived = true;
      this.bump(o);
      this.emit(o, "CUSTOMER_ARRIVED", {});
      this.markDirty();
    }
    return o;
  }
  leaving(orderId) {
    const o = this.get(orderId);
    o.leaving = true;
    this.bump(o);
    this.emit(o, "CUSTOMER_LEAVING", {});
    return o;
  }
  handover(orderId, proof) {
    const o = this.get(orderId);
    if (o.status === "HANDED_OVER" || o.status === "COMPLETED") return o;
    if (o.status !== "READY") throw new DomainError("INVALID_TRANSITION", `Order is ${o.status}`, 409);
    const p = (proof ?? "").trim().toUpperCase();
    const last4 = o.customer.phone.replace(/\D/g, "").slice(-4);
    if (p !== o.token.toUpperCase() && p !== last4) throw new DomainError("WRONG_CUSTOMER", "Token or last 4 digits of phone do not match", 403);
    this.setStatus(o, "HANDED_OVER");
    o.handedOverAt = this.now;
    this.emit(o, "ORDER_HANDED_OVER", {});
    if (o.paid) {
      this.setStatus(o, "COMPLETED");
      this.emit(o, "ORDER_COMPLETED", {});
    }
    return o;
  }
  payTableBill(orderId) {
    const o = this.get(orderId);
    if (o.paid) return o;
    o.paid = true;
    this.bump(o);
    if (o.status === "HANDED_OVER") {
      this.setStatus(o, "COMPLETED");
      this.emit(o, "ORDER_COMPLETED", {});
    }
    return o;
  }
  /** Free before any cooking starts. After that the customer can only request; a manager decides (refund policy). */
  cancel(orderId, opts = {}) {
    const o = this.get(orderId);
    if (["CANCELLED", "REFUNDED", "REFUND_PENDING"].includes(o.status)) return o;
    const mine = [...this.tasks.values()].filter((t) => t.orderId === o.id);
    const started = mine.some((t) => ["COOKING", "DONE"].includes(t.status));
    if (started && !opts.manager) throw new DomainError("COOKING_STARTED", "Cooking has started; a manager must approve the cancellation", 409, { options: ["keep order", "request manager review"] });
    if (!["PLACED", "PAID", "ACCEPTED", "SCHEDULED", "COOKING", "ASSEMBLY", "EXPO_CHECK"].includes(o.status)) throw new DomainError("INVALID_TRANSITION", `Order is ${o.status}`, 409);
    const consumedTasks = mine.filter((t) => ["COOKING", "DONE"].includes(t.status));
    for (const t of mine) if (["PLANNED", "READY", "RELEASED", "BLOCKED"].includes(t.status)) t.status = "CANCELLED";
    for (const t of consumedTasks) {
      const m = this.menu.get(t.itemId);
      for (const r of m.recipe) if (!r.pack) this.inventory.waste(r.ingredient, r.qty, t.id, "order cancelled after cooking");
    }
    const res = this.reserved.get(o.id);
    if (res) {
      const left = new Map(res);
      for (const t of consumedTasks) {
        const m = this.menu.get(t.itemId);
        for (const r of m.recipe) if (!r.pack) left.set(r.ingredient, (left.get(r.ingredient) ?? 0) - r.qty);
      }
      for (const [k, v] of left) if (v <= 0) left.delete(k);
      this.inventory.release(left, o.id);
      this.reserved.delete(o.id);
    }
    this.setStatus(o, "CANCELLED");
    o.cancelReason = opts.reason ?? "customer request";
    this.emit(o, "ORDER_CANCELLED", { reason: o.cancelReason });
    if (o.paid && o.paymentMode !== "TABLE_BILL") {
      const policy = opts.refund ?? (started ? "PARTIAL" : "FULL");
      const amt = policy === "FULL" ? o.total : policy === "PARTIAL" ? Math.round(o.total * 0.5) : 0;
      if (amt > 0) {
        this.setStatus(o, "REFUND_PENDING");
        o.refund = "REFUND_PENDING";
        o.refundAmount = amt;
        this.emit(o, "REFUND_PENDING", { amount: amt });
        this.setStatus(o, "REFUNDED");
        o.refund = "REFUNDED";
        this.emit(o, "REFUNDED", { amount: amt, key: `refund:${o.id}:${policy}` });
      }
    }
    this.markDirty();
    return o;
  }
  // ---------- time-driven work ----------
  tick() {
    const now = this.now;
    for (const o of this.orders.values()) {
      if (o.status === "PLACED" && o.holdExpiresAt && now >= o.holdExpiresAt) {
        this.setStatus(o, "EXPIRED");
        const r = this.reserved.get(o.id);
        if (r) {
          this.inventory.release(r, o.id);
          this.reserved.delete(o.id);
        }
        for (const t of this.tasks.values()) if (t.orderId === o.id) t.status = "CANCELLED";
        this.emit(o, "ORDER_EXPIRED", {});
      }
      if (o.status === "READY" && o.readyAt && now - o.readyAt >= this.S.noShowGraceMin * MIN) {
        this.setStatus(o, "NO_SHOW");
        this.emit(o, "NO_SHOW", {});
      }
      if (o.status === "READY" && o.readyNotifyAt && now >= o.readyNotifyAt) this.sendReadyIfDue(o);
    }
    if (this.dirty || now - this.lastPlanAt >= 3e4) this.replan();
  }
  sentReady = /* @__PURE__ */ new Set();
  sendReadyIfDue(o) {
    if (this.sentReady.has(o.id)) return;
    this.sentReady.add(o.id);
    this.dispatch(o, "ORDER_READY");
  }
  // ---------- notifications ----------
  notifyFor(o, type) {
    if (type === "ORDER_ACCEPTED") this.dispatch(o, "ORDER_ACCEPTED");
    else if (type === "ORDER_PREPARING") this.dispatch(o, "ORDER_PREPARING");
    else if (type === "ETA_UPDATED") {
      const last = this.events[this.events.length - 1];
      if (last.data?.later && o.delayNotices < this.S.maxDelayNotices) {
        o.delayNotices++;
        this.dispatch(o, "DELAY_DETECTED");
      }
    }
  }
  dispatch(o, ev) {
    const key = `${o.id}:${ev}:${ev === "DELAY_DETECTED" ? o.delayNotices : 0}`;
    if (this.notifications.some((n) => n.dedupeKey === key)) return;
    const q = makeQuote(o.promisedP50 ?? this.now, this.now, this.now);
    const link = `${this.trackingBase}/${o.id}`;
    const tryWa = !this.failWhatsapp;
    const channel = tryWa ? "WHATSAPP" : "SMS";
    this.notifications.push({ id: ++this.seq.notif, orderId: o.id, event: ev, channel, status: "SENT", text: render(ev, o, q, link, channel), animation: ANIMATION[ev], at: this.now, dedupeKey: key });
  }
  // ---------- queries ----------
  get(id) {
    const o = this.orders.get(id);
    if (!o) throw new DomainError("NOT_FOUND", "Order not found", 404);
    return o;
  }
  getTask(id) {
    const t = this.tasks.get(id);
    if (!t) throw new DomainError("NOT_FOUND", "Task not found", 404);
    return t;
  }
  live(orderId) {
    const o = this.get(orderId);
    const q = makeQuote(o.promisedP50 ?? o.deadline, this.now, this.now);
    const tasks = [...this.tasks.values()].filter((t) => t.orderId === o.id && t.status !== "CANCELLED" && t.status !== "FAILED");
    const done = tasks.filter((t) => t.status === "DONE").length;
    const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const phase = ["READY", "HANDED_OVER", "COMPLETED"].includes(o.status) ? "ready" : ["COOKING", "ASSEMBLY", "EXPO_CHECK"].includes(o.status) ? "preparing" : ["ACCEPTED", "SCHEDULED"].includes(o.status) ? "accepted" : o.status.toLowerCase();
    const readyVisible = !(o.status === "READY" && o.readyNotifyAt != null && this.now < o.readyNotifyAt && false);
    return {
      id: o.id,
      token: o.token,
      status: o.status,
      phase,
      version: o.version,
      mode: o.mode,
      items: o.items,
      total: o.total,
      progress,
      eta: o.status === "READY" || o.status === "HANDED_OVER" || o.status === "COMPLETED" ? null : { lo: q.lo, hi: q.hi, readyAt: o.promisedP50 },
      leaveAt: o.leaveAt ?? null,
      slotAt: o.slotAt ?? null,
      arrived: o.arrived,
      paid: o.paid,
      readyVisible,
      notifications: this.notifications.filter((n) => n.orderId === o.id)
    };
  }
  kds(station) {
    const now = this.now;
    const tasks = this.liveTasks().filter((t) => !station || t.station === station);
    const card = (t) => {
      const o = this.get(t.orderId);
      const m = this.menu.get(t.itemId);
      const holdLeft = t.status === "DONE" && t.actualFinish ? t.actualFinish + m.holdMin * MIN - now : null;
      return {
        id: t.id,
        orderId: o.id,
        token: o.token,
        mode: o.mode,
        item: m.name,
        emoji: m.emoji,
        station: t.station,
        status: t.status,
        batchId: t.batchId ?? null,
        plannedStart: t.plannedStart ?? null,
        plannedFinish: t.plannedFinish ?? null,
        actualStart: t.actualStart ?? null,
        cookMs: m.cookMin * MIN,
        holdLeftMs: holdLeft,
        arrived: o.arrived,
        deadline: o.deadline,
        table: o.table ?? null,
        priority: o.mode === "TAKEAWAY" || o.arrived ? 2 : 1
      };
    };
    const cards = tasks.map(card);
    const atRisk = [...this.orders.values()].filter((o) => ["SCHEDULED", "COOKING", "ASSEMBLY", "EXPO_CHECK"].includes(o.status) && o.plannedReadyAt && o.plannedReadyAt > Math.max(o.promisedP80 ?? 0, o.mode === "PREORDER" ? o.deadline + 2 * MIN : 0)).map((o) => ({ orderId: o.id, token: o.token, readyInMin: Math.ceil((o.plannedReadyAt - now) / MIN) }));
    const stale = cards.filter((c2) => c2.status === "DONE" && c2.holdLeftMs != null && c2.holdLeftMs < MIN).map((c2) => ({ taskId: c2.id, token: c2.token, item: c2.item, holdLeftMs: c2.holdLeftMs }));
    return {
      now,
      NOW: cards.filter((c2) => c2.status === "RELEASED"),
      COOKING: cards.filter((c2) => c2.status === "COOKING"),
      UPCOMING: cards.filter((c2) => c2.status === "PLANNED" && c2.plannedStart != null && c2.plannedStart - now <= 10 * MIN),
      LATER: cards.filter((c2) => c2.status === "PLANNED" && (c2.plannedStart == null || c2.plannedStart - now > 10 * MIN)),
      BLOCKED: cards.filter((c2) => c2.status === "BLOCKED"),
      AT_RISK: atRisk,
      HOLD_ALERTS: stale
    };
  }
  expo() {
    const now = this.now;
    const mk = (o) => ({ orderId: o.id, token: o.token, mode: o.mode, table: o.table ?? null, status: o.status, items: o.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty })), readyAt: o.readyAt ?? null, undoLeftMs: o.status === "READY" && o.readyNotifyAt ? Math.max(0, o.readyNotifyAt - now) : null, arrived: o.arrived, customer: o.customer.name, packaging: o.mode !== "DINE_IN" });
    const all = [...this.orders.values()];
    return { toPack: all.filter((o) => ["ASSEMBLY", "EXPO_CHECK"].includes(o.status)).map(mk), ready: all.filter((o) => o.status === "READY").map(mk) };
  }
  menuView() {
    return [...this.menu.values()].map((m) => ({ ...m, available: this.inventory.portionsLeft(m, true) > 0, portionsLeft: this.inventory.portionsLeft(m, true) }));
  }
  stats() {
    const all = [...this.orders.values()];
    const done = all.filter((o) => o.readyAt && o.acceptedAt);
    const waits = done.filter((o) => o.mode !== "PREORDER").map((o) => (o.readyAt - o.createdAt) / MIN).sort((a, b) => a - b);
    const pct = (p) => waits.length ? +waits[Math.min(waits.length - 1, Math.round(p * (waits.length - 1)))].toFixed(1) : 0;
    const byStatus = {};
    for (const o of all) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    return { orders: all.length, byStatus, revenue: all.filter((o) => o.paid && !["CANCELLED", "REFUNDED"].includes(o.status)).reduce((s, o) => s + o.total, 0), presentWaitP50: pct(0.5), presentWaitP90: pct(0.9), policy: this.policy, unitsOnline: this.unitsOnline };
  }
  snapshot() {
    return { orders: [...this.orders.values()], tasks: [...this.tasks.values()], events: this.events, notifications: this.notifications, inventory: this.inventory.snapshot(), tokens: this.tokens.snapshot(), seq: this.seq, idem: [...this.idem], paymentEvents: [...this.paymentEvents], reserved: [...this.reserved].map(([k, v]) => [k, [...v]]), sentReady: [...this.sentReady], unitsOnline: this.unitsOnline, businessDay: this.businessDay };
  }
  restore(s) {
    this.orders = new Map(s.orders.map((o) => [o.id, o]));
    this.tasks = new Map(s.tasks.map((t) => [t.id, t]));
    this.events = s.events;
    this.notifications = s.notifications;
    this.inventory.restore(s.inventory);
    this.tokens = new TokenIssuer(s.tokens);
    this.seq = s.seq;
    this.idem = new Map(s.idem);
    this.paymentEvents = new Set(s.paymentEvents);
    this.reserved = new Map(s.reserved.map(([k, v]) => [k, new Map(v)]));
    this.sentReady = new Set(s.sentReady);
    this.unitsOnline = s.unitsOnline;
    this.businessDay = s.businessDay;
    this.dirty = true;
  }
  closeDay() {
    this.tokens.reset();
    this.businessDay = this.dayKey();
  }
};

// apps/api/src/http/router.ts
var Router = class {
  routes = [];
  add(method, path, h) {
    const keys = [];
    const re = new RegExp("^" + path.replace(/:([a-zA-Z_]+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    }) + "/?$");
    this.routes.push({ method, re, keys, h });
    return this;
  }
  get(p, h) {
    return this.add("GET", p, h);
  }
  post(p, h) {
    return this.add("POST", p, h);
  }
  match(method, path) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (m) return { h: r.h, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
  pathExists(path) {
    return this.routes.some((r) => r.re.test(path));
  }
};
var json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

// apps/api/src/http/auth.ts
var CAN = {
  "kds.read": ["cook", "expo", "manager"],
  "expo.read": ["expo", "cashier", "waiter", "manager"],
  "task.write": ["cook", "manager"],
  "expo.write": ["expo", "cashier", "waiter", "manager"],
  "order.create.staff": ["cashier", "waiter", "manager"],
  "order.accept": ["cashier", "waiter", "manager"],
  "order.handover": ["expo", "cashier", "waiter", "manager"],
  "order.cancel.staff": ["cashier", "manager"],
  "order.cancel.cooking": ["manager"],
  "order.read.all": ["cashier", "waiter", "expo", "cook", "manager"],
  "inventory.read": ["cook", "expo", "cashier", "manager"],
  "inventory.write": ["manager"],
  "admin": ["manager"],
  "resource.write": ["cook", "manager"]
};
function pinsFromEnv(env) {
  const d = { "1111": "cook", "2222": "expo", "3333": "cashier", "4444": "waiter", "9999": "manager" };
  if (!env.STAFF_PINS) return d;
  const out = {};
  for (const p of env.STAFF_PINS.split(",")) {
    const [pin, role] = p.split(":");
    if (pin && role) out[pin] = role;
  }
  return out;
}
function requireRole(req, pins, cap) {
  const pin = req.headers.get("x-staff-pin") ?? new URL(req.url).searchParams.get("pin") ?? "";
  const role = pins[pin];
  if (!role) throw new DomainError("UNAUTHENTICATED", "Staff PIN required", 401);
  if (!CAN[cap].includes(role)) throw new DomainError("FORBIDDEN", `Role ${role} cannot do ${cap}`, 403);
  return role;
}
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
var RateLimiter = class {
  hits = /* @__PURE__ */ new Map();
  max;
  windowMs;
  now;
  constructor(max, windowMs, now = Date.now) {
    this.max = max;
    this.windowMs = windowMs;
    this.now = now;
  }
  check(key) {
    const t = this.now();
    const a = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (a.length >= this.max) {
      this.hits.set(key, a);
      throw new DomainError("RATE_LIMITED", "Too many requests, slow down", 429);
    }
    a.push(t);
    this.hits.set(key, a);
  }
};

// apps/api/src/demo.ts
var c = (n) => ({ name: n, phone: "9876543210" });
var SCENARIOS = {
  four: { title: "Four customers: 1 km main course \xB7 500 m 5 burgers \xB7 seated \xB7 standing", orders: [
    { atMin: 0, input: { channel: "WHATSAPP", mode: "PREORDER", customer: c("A (1 km)"), distanceKm: 1, slotInMin: 15, items: [{ menuItemId: "chowmein", qty: 1 }] } },
    { atMin: 1, input: { channel: "APP", mode: "PREORDER", customer: c("B (500 m)"), distanceKm: 0.5, slotInMin: 15, items: [{ menuItemId: "burger", qty: 5 }] } },
    { atMin: 2, input: { channel: "QR", mode: "DINE_IN", table: "4", customer: c("C (seated)"), items: [{ menuItemId: "burger", qty: 2 }, { menuItemId: "cold_drink", qty: 1 }, { menuItemId: "coffee", qty: 1 }] } },
    { atMin: 3, input: { channel: "COUNTER", mode: "TAKEAWAY", customer: c("D (standing)"), items: [{ menuItemId: "burger", qty: 1 }, { menuItemId: "fries", qty: 1 }] } }
  ] }
};

// apps/api/src/app.ts
var enc = new TextEncoder();
function createApp(o) {
  const { engine: e } = o;
  const env = o.env ?? {};
  const pins = pinsFromEnv(env);
  const secret = env.PAYMENT_WEBHOOK_SECRET ?? "dev-secret";
  const dev = o.dev ?? true;
  const auto = o.autopilot ?? { on: false };
  const speed = o.speed ?? 1;
  const later = o.later ?? ((fn, ms) => {
    setTimeout(fn, ms);
  });
  const orderLimiter = new RateLimiter(10, 6e4);
  const staff = (c2, cap) => requireRole(c2.req, pins, cap);
  const r = new Router();
  const keyOf = (c2) => c2.url.searchParams.get("key") ?? c2.req.headers.get("x-order-key") ?? "";
  const orderFor = (c2, id) => {
    const ord = e.get(id);
    const pinRole = pins[c2.req.headers.get("x-staff-pin") ?? ""];
    if (!pinRole && !safeEqual(keyOf(c2), ord.accessKey)) throw new DomainError("NOT_FOUND", "Order not found", 404);
    return ord;
  };
  const ifMatch = (c2, id) => {
    const h = c2.req.headers.get("if-match");
    if (h != null && Number(h) !== e.get(id).version) throw new DomainError("STALE_VERSION", "The order changed; reload and retry", 409, { currentVersion: e.get(id).version });
  };
  const pub = (ord) => ({ ...e.live(ord.id), accessKey: ord.accessKey });
  const idem = (c2) => {
    const k = c2.req.headers.get("idempotency-key");
    if (!k || k.length < 8) throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header (8+ chars)", 400);
    return k;
  };
  r.get("/health", () => json({ ok: true, policy: e.policy, now: e.now, units: e.unitsOnline }));
  r.get("/menu", () => json({ items: e.menuView() }));
  r.get("/board", () => {
    e.tick();
    const all = [...e.orders.values()];
    return json({ preparing: all.filter((x) => ["SCHEDULED", "COOKING", "ASSEMBLY", "EXPO_CHECK"].includes(x.status) && x.token && (x.mode !== "PREORDER" || x.arrived || (x.plannedReadyAt ?? Infinity) - e.now < 12 * MIN)).map((x) => x.token), ready: all.filter((x) => x.status === "READY" && (x.readyNotifyAt ?? 0) <= e.now).map((x) => x.token) });
  });
  r.post("/orders", (c2) => {
    const b = c2.body;
    if (b?.customer?.phone) orderLimiter.check("phone:" + b.customer.phone);
    if (b.channel === "COUNTER") throw new DomainError("FORBIDDEN", "Counter orders are created by staff", 403);
    const k = idem(c2);
    const res = e.createOrder({ ...b, paymentMode: void 0 }, k);
    e.tick();
    return json({ order: pub(res.order), duplicate: res.duplicate, payment: res.order.status === "PLACED" ? { required: true, amount: res.order.total, holdExpiresAt: res.order.holdExpiresAt } : { required: false } }, res.duplicate ? 200 : 201);
  });
  r.get("/orders/:id", (c2) => json(pub(orderFor(c2, c2.params.id))));
  r.get("/orders/:id/live", (c2) => json(pub(orderFor(c2, c2.params.id))));
  r.get("/orders/:id/eta", (c2) => {
    const l = e.live(orderFor(c2, c2.params.id).id);
    return json({ eta: l.eta, leaveAt: l.leaveAt });
  });
  r.post("/orders/:id/cancel", (c2) => {
    const ord = orderFor(c2, c2.params.id);
    ifMatch(c2, ord.id);
    const hasPin = !!pins[c2.req.headers.get("x-staff-pin") ?? ""];
    let manager = false;
    let refund;
    if (hasPin) {
      const role = staff(c2, "order.cancel.staff");
      manager = role === "manager";
      refund = manager ? c2.body?.refund : void 0;
    }
    const out = e.cancel(ord.id, { manager, refund, reason: c2.body?.reason });
    e.tick();
    return json(pub(out));
  });
  r.post("/orders/:id/arrived", (c2) => {
    const ord = orderFor(c2, c2.params.id);
    e.arrived(ord.id);
    e.tick();
    return json(pub(ord));
  });
  r.post("/orders/:id/leaving", (c2) => {
    const ord = orderFor(c2, c2.params.id);
    e.leaving(ord.id);
    return json(pub(ord));
  });
  r.get("/orders/:id/stream", (c2) => {
    const ord = orderFor(c2, c2.params.id);
    return sse(e, (ev) => ev.orderId === ord.id, () => pub(ord));
  });
  r.post("/webhooks/payments", async (c2) => {
    const raw = c2.raw;
    const sig = c2.req.headers.get("x-signature") ?? "";
    if (!safeEqual(await hmacHex(secret, raw), sig)) throw new DomainError("BAD_SIGNATURE", "Webhook signature invalid", 401);
    const b = c2.body;
    const res = e.confirmPayment(b.provider_event_id, b.order_id, b.amount);
    e.tick();
    return json({ ok: true, duplicate: res.duplicate });
  });
  if (dev) r.post("/dev/pay/:id", async (c2) => {
    const ord = orderFor(c2, c2.params.id);
    const body = JSON.stringify({ provider_event_id: "dev-" + ord.id, order_id: ord.id, amount: ord.total });
    const res = e.confirmPayment("dev-" + ord.id, ord.id, ord.total);
    e.tick();
    void body;
    return json({ ok: true, duplicate: res.duplicate, order: pub(e.get(ord.id)) });
  });
  r.post("/staff/orders", (c2) => {
    const role = staff(c2, "order.create.staff");
    const k = idem(c2);
    const b = c2.body;
    if (role === "waiter" && b.mode !== "DINE_IN") throw new DomainError("FORBIDDEN", "Waiters create dine-in orders", 403);
    const res = e.createOrder({ ...b, channel: b.channel ?? "COUNTER" }, k);
    if (res.order.status === "PLACED" && res.order.paymentMode !== "PREPAID") e.accept(res.order.id, c2.body?.deviceSeries);
    e.tick();
    return json({ order: pub(res.order), duplicate: res.duplicate }, 201);
  });
  r.get("/staff/orders", (c2) => {
    staff(c2, "order.read.all");
    const st = c2.url.searchParams.get("status");
    const list = [...e.orders.values()].filter((x) => !st || st.split(",").includes(x.status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map((x) => ({ id: x.id, token: x.token, mode: x.mode, status: x.status, version: x.version, customer: x.customer.name, table: x.table ?? null, total: x.total, paid: x.paid, paymentMode: x.paymentMode, items: x.items.map((i) => `${i.qty}\xD7 ${i.name}`), eta: e.live(x.id).eta, createdAt: x.createdAt, arrived: x.arrived, accessKey: x.accessKey }));
    return json({ orders: list });
  });
  r.post("/orders/:id/accept", (c2) => {
    staff(c2, "order.accept");
    ifMatch(c2, c2.params.id);
    const out = e.accept(c2.params.id);
    e.tick();
    return json(pub(out));
  });
  r.post("/orders/:id/pay", (c2) => {
    staff(c2, "order.accept");
    return json(pub(e.payTableBill(c2.params.id)));
  });
  r.post("/orders/:id/ready", (c2) => {
    staff(c2, "expo.write");
    ifMatch(c2, c2.params.id);
    const out = e.markReady(c2.params.id, c2.body?.checked ?? []);
    return json(pub(out));
  });
  r.post("/orders/:id/undo-ready", (c2) => {
    staff(c2, "expo.write");
    return json(pub(e.undoReady(c2.params.id)));
  });
  r.post("/orders/:id/handover", (c2) => {
    staff(c2, "order.handover");
    return json(pub(e.handover(c2.params.id, c2.body?.proof ?? "")));
  });
  r.get("/kds", (c2) => {
    staff(c2, "kds.read");
    const st = c2.url.searchParams.get("station");
    e.tick();
    return json(e.kds(st ?? void 0));
  });
  r.get("/expo", (c2) => {
    staff(c2, "expo.read");
    e.tick();
    return json(e.expo());
  });
  r.post("/tasks/:id/start", (c2) => {
    staff(c2, "task.write");
    e.startTask(c2.params.id, !!c2.body?.force && staff(c2, "admin") === "manager");
    e.tick();
    return json({ ok: true });
  });
  r.post("/tasks/:id/done", (c2) => {
    staff(c2, "task.write");
    e.doneTask(c2.params.id);
    e.tick();
    return json({ ok: true });
  });
  r.post("/tasks/:id/fail", (c2) => {
    staff(c2, "task.write");
    const t = e.failTask(c2.params.id, c2.body?.reason ?? "dropped");
    return json({ ok: true, replacement: t.id });
  });
  r.post("/stations/:id/units", (c2) => {
    staff(c2, "resource.write");
    e.setUnits(c2.params.id, Number(c2.body?.units));
    return json({ units: e.unitsOnline });
  });
  r.get("/stream/staff", (c2) => {
    staff(c2, "order.read.all");
    return sse(e, () => true, () => ({ hello: true }));
  });
  r.get("/inventory", (c2) => {
    staff(c2, "inventory.read");
    return json({ items: [...e.inventory.items.values()].map((i) => ({ ...i, available: i.onHand - i.reserved, status: e.inventory.status(i.id) })), menu: e.menuView().map((m) => ({ id: m.id, name: m.name, portionsLeft: m.portionsLeft, available: m.available })) });
  });
  r.get("/ledger", (c2) => {
    staff(c2, "inventory.read");
    const ing2 = c2.url.searchParams.get("ingredient");
    return json({ entries: e.inventory.ledger.filter((l) => !ing2 || l.ingredient === ing2).slice(-200).reverse() });
  });
  r.post("/inventory/receipt", (c2) => {
    staff(c2, "inventory.write");
    e.inventory.receipt(c2.body.ingredient, Number(c2.body.qty));
    return json({ ok: true });
  });
  r.post("/inventory/adjust", (c2) => {
    staff(c2, "inventory.write");
    return json({ diff: e.inventory.adjust(c2.body.ingredient, Number(c2.body.counted), c2.body.note) });
  });
  r.post("/inventory/waste", (c2) => {
    staff(c2, "inventory.write");
    e.inventory.waste(c2.body.ingredient, Number(c2.body.qty), "manual", c2.body.reason ?? "waste");
    return json({ ok: true });
  });
  r.get("/admin/stats", (c2) => {
    staff(c2, "admin");
    return json({ ...e.stats(), autopilot: auto.on, speed, scenarios: Object.entries(SCENARIOS).map(([id, s]) => ({ id, title: s.title })) });
  });
  r.get("/admin/plan", (c2) => {
    staff(c2, "admin");
    e.tick();
    const tasks = [...e.tasks.values()].filter((t) => ["PLANNED", "RELEASED", "COOKING", "DONE"].includes(t.status) && e.get(t.orderId).status !== "COMPLETED").map((t) => ({ id: t.id, token: e.get(t.orderId).token, station: t.station, unit: t.unit ?? 0, item: e.menu.get(t.itemId).name, status: t.status, start: t.actualStart ?? t.plannedStart ?? null, end: t.actualStart ? t.actualStart + e.menu.get(t.itemId).cookMin * MIN : t.plannedFinish ?? null, batchId: t.batchId ?? null }));
    return json({ now: e.now, tasks });
  });
  r.post("/admin/autopilot", (c2) => {
    staff(c2, "admin");
    auto.on = !!c2.body?.on;
    return json({ autopilot: auto.on });
  });
  r.post("/admin/policy", (c2) => {
    staff(c2, "admin");
    const p = c2.body?.policy;
    if (!["smart", "fifo", "deadline"].includes(p)) throw new DomainError("BAD_POLICY", "policy must be smart, fifo or deadline", 400);
    e.policy = p;
    e.markDirty();
    e.replan();
    return json({ policy: e.policy });
  });
  r.post("/admin/close-day", (c2) => {
    staff(c2, "admin");
    e.closeDay();
    return json({ ok: true });
  });
  r.post("/admin/scenario/:id", (c2) => {
    staff(c2, "admin");
    const s = SCENARIOS[c2.params.id];
    if (!s) throw new DomainError("NOT_FOUND", "Unknown scenario", 404);
    const made = [];
    s.orders.forEach((x, i) => later(() => {
      try {
        const res = e.createOrder(x.input, `scn-${c2.params.id}-${e.now}-${i}`);
        const ord = res.order;
        if (ord.status === "PLACED") {
          if (ord.paymentMode === "PREPAID") e.confirmPayment(`scn-pay-${ord.id}`, ord.id, ord.total);
          else e.accept(ord.id);
        }
        made.push(ord.token);
        e.tick();
      } catch {
      }
    }, x.atMin * MIN / speed));
    return json({ scheduled: s.orders.length, title: s.title });
  });
  r.get("/admin/notifications", (c2) => {
    staff(c2, "admin");
    return json({ notifications: e.notifications.slice(-60).reverse() });
  });
  return async function handle2(req) {
    const url = new URL(req.url);
    const requestId = crypto.randomUUID().slice(0, 8);
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,idempotency-key,x-staff-pin,x-order-key,if-match,x-signature", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const m = r.match(req.method, url.pathname);
      if (!m) throw new DomainError("NOT_FOUND", r.pathExists(url.pathname) ? "Method not allowed" : "Route not found", r.pathExists(url.pathname) ? 405 : 404);
      let body = {};
      let raw = "";
      if (req.method === "POST") {
        raw = await req.text();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            throw new DomainError("BAD_JSON", "Body must be JSON", 400);
          }
        }
      }
      const ctx = { req, url, params: m.params, body, requestId };
      ctx.raw = raw;
      const res = await m.h(ctx);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      h.set("x-request-id", requestId);
      return new Response(res.body, { status: res.status, headers: h });
    } catch (err) {
      if (err instanceof DomainError) return json({ error: { code: err.code, message: err.message, details: err.details, request_id: requestId } }, err.status, cors);
      console.error("unhandled", requestId, err);
      return json({ error: { code: "INTERNAL", message: "Something went wrong", request_id: requestId } }, 500, cors);
    }
  };
}
function sse(e, filter, first) {
  let off = () => {
  };
  let beat;
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (name, data) => {
        try {
          ctrl.enqueue(enc.encode(`event: ${name}
data: ${JSON.stringify(data)}

`));
        } catch {
          off();
        }
      };
      send("snapshot", first());
      off = e.on((ev) => {
        if (filter(ev)) send("event", { type: ev.type, orderId: ev.orderId, version: ev.version, at: ev.at });
      });
      beat = setInterval(() => {
        try {
          ctrl.enqueue(enc.encode(": ping\n\n"));
        } catch {
          off();
        }
      }, 15e3);
    },
    cancel() {
      off();
      if (beat) clearInterval(beat);
    }
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
}

// api/index.ts
var engine = null;
var handle = null;
var autoInterval = null;
function getApp() {
  if (!handle) {
    const clock = { now: () => Date.now() };
    engine = new Engine({
      clock,
      policy: process.env.POLICY ?? "smart",
      trackingBase: "/track.html?o"
    });
    const auto = { on: true };
    handle = createApp({
      engine,
      env: process.env,
      dev: true,
      autopilot: auto
    });
    if (!autoInterval) {
      autoInterval = setInterval(() => {
        if (!engine) return;
        try {
          engine.tick();
          for (const t of engine.tasks.values()) {
            if (t.status === "RELEASED") {
              try {
                engine.startTask(t.id);
              } catch {
              }
            }
          }
          for (const t of engine.tasks.values()) {
            if (t.status === "COOKING" && clock.now() >= t.actualStart + engine.menu.get(t.itemId).cookMin * MIN) {
              try {
                engine.doneTask(t.id);
              } catch {
              }
            }
          }
          for (const o of engine.orders.values()) {
            if (o.status === "ASSEMBLY") {
              const op = engine.lastPlan.orders.get(o.id);
              if (!op || clock.now() >= op.packStart) {
                try {
                  engine.markReady(o.id, o.items.map((i) => i.id));
                } catch {
                }
              }
            }
          }
        } catch {
        }
      }, 1e3);
    }
  }
  return handle;
}
async function handler(req, res) {
  const app = getApp();
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const rawUrl = new URL(req.url || "/", `${proto}://${host}`);
    let reqPath = rawUrl.searchParams.get("path") || req.headers["x-matched-path"] || rawUrl.pathname;
    rawUrl.searchParams.delete("path");
    if (reqPath.startsWith("/api") && reqPath.length > 4) {
      reqPath = reqPath.slice(4);
    }
    const query = rawUrl.search ? rawUrl.search : "";
    const fullUrl = new URL(reqPath + query, `${proto}://${host}`);
    let body = void 0;
    if (req.method === "POST") {
      if (typeof req.body === "string") {
        body = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        body = req.body.toString("utf8");
      } else if (req.body && typeof req.body === "object") {
        body = JSON.stringify(req.body);
      } else {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        if (chunks.length) body = Buffer.concat(chunks).toString("utf8");
      }
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(", "));
    }
    const webRequest = new Request(fullUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? void 0 : body
    });
    const webResponse = await app(webRequest);
    res.status(webResponse.status);
    webResponse.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    if (webResponse.body) {
      const text = await webResponse.text();
      res.send(text);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[Vercel API]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: err?.message || "Server Error" } });
    }
  }
}
export {
  handler as default
};
