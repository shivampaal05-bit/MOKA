// Tiny fetch-style router (works on Node and on Cloudflare Workers: it only uses Request/Response).
export type Ctx = { req: Request; url: URL; params: Record<string, string>; body: any; requestId: string };
export type Handler = (c: Ctx) => Response | Promise<Response>;
interface Route { method: string; re: RegExp; keys: string[]; h: Handler }
export class Router {
  private routes: Route[] = [];
  add(method: string, path: string, h: Handler) { const keys: string[] = []; const re = new RegExp('^' + path.replace(/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$'); this.routes.push({ method, re, keys, h }); return this; }
  get(p: string, h: Handler) { return this.add('GET', p, h); } post(p: string, h: Handler) { return this.add('POST', p, h); }
  match(method: string, path: string) { for (const r of this.routes) { if (r.method !== method) continue; const m = r.re.exec(path); if (m) return { h: r.h, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; } return null; }
  pathExists(path: string) { return this.routes.some(r => r.re.test(path)); }
}
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
