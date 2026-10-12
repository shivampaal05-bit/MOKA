# MOKA · Your Daily Fix
> **Crafted Coffee • Fresh Bakes • All Day, All Night**  
> Flagship: Hotel Buddha Avenue • Gorakhpur

Modern restaurant management, kitchen orchestration (Smart Queue), and live customer tracking platform branded for **MOKA**.

### Brand Palette
- **Plum Purple**: `#654765` (Primary identity, header, and buttons)
- **Dusty Lilac**: `#BFA9C7` (Secondary accents and soft tags)
- **Ivory**: `#F5EFE8` (Warm page surfaces and backgrounds)
- **Champagne**: `#C6A77E` (Restrained luxury highlights, badges, pricing)

---

## Quick Start (Node 22 or newer, no external dependencies needed)

```bash
npm run setup      # Links workspace packages (@queuebite/core, api, simulator)
npm test           # Runs all 41 test suites: engine, state machine, stock, scheduler
npm run dev        # Starts local server on http://localhost:8787
npm run demo       # Starts server with autopilot kitchen & 6x simulation
npm run simulate   # Replays scheduler under FIFO vs Deadline vs Smart
```

### Live Screens (Served directly by the Node engine):
- **Customer Ordering**: `http://localhost:8787/index.html` (Pre-order & Pickup, Dine-in, Counter Takeaway)
- **Live Order Tracker**: `http://localhost:8787/track.html` (Token P/T/W, ETA, animated steps, WhatsApp notifications)
- **Kitchen Display System (KDS)**: `http://localhost:8787/kds.html` (Cook stations, live batches, timers)
- **Counter & Waiter Terminal**: `http://localhost:8787/counter.html` (Walk-ins, table orders, expo quality check)
- **Lobby TV Board**: `http://localhost:8787/tv.html` (Now Preparing & Ready tokens)
- **Store Owner & Analytics**: `http://localhost:8787/owner.html` (Live revenue, ingredient stock, autopilot toggles)

**Demo Staff PINs**: Cook `1111` · Expo `2222` · Cashier `3333` · Waiter `4444` · Manager `9999`

## Folder structure
```
queuebite/
├─ packages/core/            Pure business logic. No HTTP, no database, no clock of its own.
│  ├─ src/
│  │  ├─ engine.ts           Orders, tasks, stock, notifications in one deterministic engine
│  │  ├─ types.ts            Shared types
│  │  ├─ config/menu.ts      Menu, recipes (BOM), cook times, batch size, hold limits
│  │  ├─ orders/             state-machine.ts (valid transitions), tokens.ts (P/T/W)
│  │  ├─ scheduler/          plan.ts (Smart Queue, FIFO, Deadline), eta.ts (P50/P80 ranges)
│  │  ├─ inventory/ledger.ts Reserve, consume, release, waste, receipt, adjust
│  │  └─ notifications/      templates.ts (accepted, preparing, ready, delay)
│  └─ test/                  Unit tests (scheduler fairness, state machine, stock, engine)
├─ apps/
│  ├─ api/                   HTTP layer. One fetch handler that runs on Node and on Cloudflare Workers.
│  │  ├─ src/app.ts          Routes, roles, idempotency, rate limits, webhooks, SSE streams
│  │  ├─ src/http/           router.ts, auth.ts (PIN roles, HMAC, rate limiter)
│  │  ├─ src/store/          snapshot-store.ts (SQLite / file persistence)
│  │  ├─ src/adapters/       node.ts (server + scheduler tick + autopilot), cloudflare-worker.ts
│  │  ├─ src/demo.ts         Demo scenarios
│  │  └─ test/               API and storage tests
│  └─ web/public/            No-build screens: customer, tracking, KDS, counter, TV, owner
├─ db/                       PostgreSQL production schema (not used by the local demo)
│  ├─ migrations/            001_init.sql, 002_stock_functions.sql
│  ├─ seed/seed.sql          Generated from the menu (npm run gen:seed)
│  └─ tests/reserve_race.sh  Concurrent last-bun reservation test (needs a Postgres)
├─ infra/cloudflare/         wrangler.jsonc with placeholders (no real IDs)
├─ tools/simulator/          Replays scenarios under FIFO / Deadline / Smart and prints metrics
├─ scripts/                  link-workspaces.mjs, gen-seed.mjs
└─ docs/                     Architecture notes
```
Dependency rule: `packages/core` imports nothing from `apps`; `apps/api` imports `core`; screens only call the API.
That is what keeps the scheduler testable and lets the same code run on Node today and Workers later.

## What is real and what is not yet
- Working and tested locally: the engine, scheduler, state machine, stock ledger, API, screens, simulator, SQLite/file persistence.
- Not connected: real payment gateway, WhatsApp/SMS sending (messages are generated and listed at `/admin/notifications`),
  routing/maps, login beyond demo PINs, Postgres (schema provided, adapter not written), Cloudflare deploy (config is a template).
- Cook times, batch sizes and hold limits in `config/menu.ts` are starting values; replace them with measured ones.
- TypeScript type-check (`npm run typecheck`) was not run because the TypeScript package could not be installed in this environment.
