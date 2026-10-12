# Architecture notes
- One engine (`packages/core/src/engine.ts`) owns orders, tasks and stock. The API calls it; screens call the API.
- Flow: createOrder → (pay) → accept → tasks planned → scheduler tick releases tasks → cook Start (stock consumed) → Done → Expo check → READY (customer message after a 20 s undo window) → handover.
- Scheduler: `scheduler/plan.ts`. Present customers are released now; pre-orders are held and released backward from their pickup time; same-item tasks batch up to station capacity.
- Idempotency: every write needs an Idempotency-Key; repeats return the first result. Payment webhooks are HMAC-verified and de-duplicated.
- Realtime: server-sent events (`/orders/:id/stream`, `/stream/staff`); the Postgres/Durable Object version is described in the spec.
- Production path: implement a Postgres store behind the same engine interface using `db/migrations`, deploy `adapters/cloudflare-worker.ts` with `infra/cloudflare/wrangler.jsonc`.
