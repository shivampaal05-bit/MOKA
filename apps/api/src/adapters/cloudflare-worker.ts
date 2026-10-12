// Cloudflare adapter (UNTESTED in this repo's CI: it needs wrangler + a Cloudflare account; see infra/cloudflare/README.md).
// One Durable Object ("RestaurantHub") hosts the Engine for the outlet: a single writer, so scheduler runs are serialised
// and live streams (SSE) share one in-memory state. State is persisted to the object's own storage after every change.
// The static web screens are served by Workers Static Assets (wrangler `assets`), so this Worker only handles API paths.
import { Engine, type Clock, type Policy } from '@queuebite/core';
import { createApp } from '../app.ts';

// Minimal structural types so this file type-checks without @cloudflare/workers-types.
interface DOStorage { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void>; setAlarm(t: number): Promise<void>; getAlarm(): Promise<number | null> }
interface DOState { storage: DOStorage; blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> }
interface DONamespace { idFromName(n: string): unknown; get(id: unknown): { fetch(r: Request): Promise<Response> } }
export interface Env { HUB: DONamespace; STAFF_PINS?: string; PAYMENT_WEBHOOK_SECRET?: string; PUBLIC_URL?: string; POLICY?: string }

const API = /^\/(health|menu|board|orders|webhooks|staff|kds|expo|tasks|stations|stream|inventory|ledger|admin)(\/|$)/;

export class RestaurantHub {
  private state: DOState; private env: Env; private engine: Engine; private handle: (r: Request) => Promise<Response>; private saveTimer = false;
  constructor(state: DOState, env: Env) {
    this.state = state; this.env = env; const clock: Clock = { now: () => Date.now() };
    this.engine = new Engine({ clock, policy: (env.POLICY as Policy) ?? 'smart', trackingBase: `${env.PUBLIC_URL ?? ''}/track.html?o` });
    this.handle = createApp({ engine: this.engine, env: env as unknown as Record<string, string | undefined>, dev: false });
    state.blockConcurrencyWhile(async () => { const snap = await state.storage.get<ReturnType<Engine['snapshot']>>('snapshot'); if (snap) this.engine.restore(snap); });
    this.engine.on(() => this.scheduleSave());
  }
  private scheduleSave() { if (this.saveTimer) return; this.saveTimer = true; setTimeout(() => { this.saveTimer = false; void this.state.storage.put('snapshot', this.engine.snapshot()); }, 300); }
  async fetch(req: Request): Promise<Response> {
    this.engine.tick(); const res = await this.handle(req); void this.arm(); return res;
  }
  /** While orders are active the object wakes itself every second to run the scheduler tick; when idle it sleeps. */
  async alarm() { this.engine.tick(); await this.arm(); }
  private async arm() {
    const active = [...this.engine.orders.values()].some(o => !['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'FAILED', 'REFUNDED', 'HANDED_OVER'].includes(o.status));
    if (active && (await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(Date.now() + 1000);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!API.test(url.pathname)) return new Response('Not found', { status: 404 }); // static screens are served by the assets binding before reaching this Worker
    const stub = env.HUB.get(env.HUB.idFromName('outlet-1')); return stub.fetch(req);
  },
};
