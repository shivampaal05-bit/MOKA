import { Engine, MIN, type Clock, type Policy } from '@queuebite/core';
import { createApp } from '../apps/api/src/app.ts';

// Global singleton in-memory engine across invocations in the same warm container
let engine: Engine | null = null;
let handle: ((req: Request) => Promise<Response>) | null = null;
let autoInterval: any = null;

function getApp() {
  if (!handle) {
    const clock: Clock = { now: () => Date.now() };
    engine = new Engine({
      clock,
      policy: (process.env.POLICY as Policy) ?? 'smart',
      trackingBase: '/track.html?o'
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
            if (t.status === 'RELEASED') { try { engine.startTask(t.id); } catch {} }
          }
          for (const t of engine.tasks.values()) {
            if (t.status === 'COOKING' && clock.now() >= t.actualStart! + engine.menu.get(t.itemId)!.cookMin * MIN) {
              try { engine.doneTask(t.id); } catch {}
            }
          }
          for (const o of engine.orders.values()) {
            if (o.status === 'ASSEMBLY') {
              const op = engine.lastPlan.orders.get(o.id);
              if (!op || clock.now() >= op.packStart) {
                try { engine.markReady(o.id, o.items.map(i => i.id)); } catch {}
              }
            }
          }
        } catch {}
      }, 1000);
    }
  }
  return handle;
}

export default async function handler(req: any, res: any) {
  const app = getApp();
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    
    // Resolve original URL from request or Vercel matched path
    let reqUrl = req.url || '/';
    if (req.headers['x-matched-path']) {
      reqUrl = req.headers['x-matched-path'];
    }
    const fullUrl = new URL(reqUrl, `${proto}://${host}`);

    // Read body if POST
    let body: any = undefined;
    if (req.method === 'POST') {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        body = req.body.toString('utf8');
      } else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        if (chunks.length) body = Buffer.concat(chunks).toString('utf8');
      }
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(', '));
    }

    const webRequest = new Request(fullUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
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
  } catch (err: any) {
    console.error('[Vercel API]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: err?.message || 'Server Error' } });
    }
  }
}
