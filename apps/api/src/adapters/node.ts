// Node adapter: serves the API (fetch handler), the static web screens, the scheduler tick, optional autopilot and durable storage.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { Engine, MIN, type Clock, type Policy } from '@queuebite/core'; import { createApp } from '../app.ts'; import { SqliteSnapshotStore, FileSnapshotStore, autosave, type SnapshotStore } from '../store/snapshot-store.ts';
const here = path.dirname(fileURLToPath(import.meta.url)); const webDir = path.resolve(here, '../../../web/public'); const dataDir = process.env.DATA_DIR ?? path.resolve(here, '../../../../data');
const PORT = Number(process.env.PORT ?? 8787); const SPEED = Number(process.env.SPEED ?? 1); const AUTOPILOT = process.env.AUTOPILOT === '1'; const STORE = process.env.STORE ?? (process.env.PERSIST === '1' ? 'sqlite' : 'none'); // none | sqlite | file
const t0 = Date.now(); const clock: Clock = { now: () => t0 + (Date.now() - t0) * SPEED }; // SPEED=6 makes 1 real second = 6 kitchen seconds (demo)
const engine = new Engine({ clock, policy: (process.env.POLICY as Policy) ?? 'smart', trackingBase: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/track.html?o` : `http://localhost:${PORT}/track.html?o` });
let store: SnapshotStore | null = null;
if (STORE === 'sqlite') store = await SqliteSnapshotStore.open(path.join(dataDir, 'queuebite.db')); else if (STORE === 'file') store = new FileSnapshotStore(path.join(dataDir, 'state.json'));
let saver: ReturnType<typeof autosave> | null = null;
if (store) { const snap = store.load(); if (snap) { try { engine.restore(snap as ReturnType<Engine['snapshot']>); console.log(`restored ${engine.orders.size} orders from ${STORE} store`); } catch (x) { console.error('could not restore state', x); } } saver = autosave(engine, store); }
const auto = { on: AUTOPILOT };
const handle = createApp({ engine, env: process.env, dev: process.env.NODE_ENV !== 'production', speed: SPEED, autopilot: auto });
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const apiPaths = /^\/(health|menu|board|orders|webhooks|dev|staff|kds|expo|tasks|stations|stream|inventory|ledger|admin)(\/|$)/;
    if (apiPaths.test(url.pathname)) {
      const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const r = await handle(new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      if (r.body) { const reader = r.body.getReader(); req.on('close', () => reader.cancel().catch(() => {})); for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value); } }
      return void res.end();
    }
    let p = url.pathname === '/' ? '/index.html' : url.pathname; p = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
    const file = path.join(webDir, p); if (!file.startsWith(webDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); return void res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(file).pipe(res);
  } catch (err) { console.error(err); if (!res.headersSent) res.writeHead(500); res.end('error'); }
});

// scheduler tick every second; autopilot plays an obedient kitchen so the demo moves on its own
setInterval(() => {
  engine.tick();
  if (!auto.on) return;
  for (const t of engine.tasks.values()) if (t.status === 'RELEASED') { try { engine.startTask(t.id); } catch { /* batch mate */ } }
  for (const t of engine.tasks.values()) if (t.status === 'COOKING' && clock.now() >= t.actualStart! + engine.menu.get(t.itemId)!.cookMin * MIN) { try { engine.doneTask(t.id); } catch { /* done */ } }
  for (const o of engine.orders.values()) if (o.status === 'ASSEMBLY') { const op = engine.lastPlan.orders.get(o.id); if (!op || clock.now() >= op.packStart) { try { engine.markReady(o.id, o.items.map(i => i.id)); } catch { /* checked */ } } }
}, 1000);
const shutdown = () => { try { saver?.stop(); store?.close(); } finally { process.exit(0); } }; process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
server.listen(PORT, () => console.log(`QueueBite running on http://localhost:${PORT}  (speed x${SPEED}${AUTOPILOT ? ', autopilot on' : ''}, storage: ${STORE})\n  customer: /index.html   kitchen: /kds.html   counter: /counter.html   owner: /owner.html\n  demo PINs: cook 1111 · expo 2222 · cashier 3333 · waiter 4444 · manager 9999`));
