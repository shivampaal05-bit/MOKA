// Durable storage for the engine. v1 persists the whole engine state as a snapshot plus an append-only event log.
// (The Postgres schema in db/migrations is the target for reporting and multi-device scale; see docs/ARCHITECTURE.md.)
import fs from 'node:fs'; import path from 'node:path';
import type { OrderEvent } from '@queuebite/core';

export interface SnapshotStore {
  load(): unknown | null;
  save(snapshot: unknown): void;
  appendEvent(e: OrderEvent): void;
  close(): void;
}

/** One JSON file, written atomically (temp file + rename) so a crash never leaves a half-written state. */
export class FileSnapshotStore implements SnapshotStore {
  private file: string;
  constructor(file: string) { this.file = file; fs.mkdirSync(path.dirname(file), { recursive: true }); }
  load() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return null; } }
  save(snapshot: unknown) { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(snapshot)); fs.renameSync(tmp, this.file); }
  appendEvent(e: OrderEvent) { fs.appendFileSync(this.file + '.events.ndjson', JSON.stringify(e) + '\n'); }
  close() {}
}

/** SQLite via Node's built-in node:sqlite (no dependency). WAL mode; snapshot + event log in one database file. */
export class SqliteSnapshotStore implements SnapshotStore {
  private db: import('node:sqlite').DatabaseSync;
  private constructor(db: import('node:sqlite').DatabaseSync) { this.db = db; }
  static async open(file: string): Promise<SqliteSnapshotStore> {
    const { DatabaseSync } = await import('node:sqlite');
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL, saved_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS order_events (id INTEGER PRIMARY KEY, order_id TEXT NOT NULL, type TEXT NOT NULL, version INTEGER NOT NULL, at INTEGER NOT NULL, data TEXT);
      CREATE INDEX IF NOT EXISTS order_events_order ON order_events(order_id, id);`);
    return new SqliteSnapshotStore(db);
  }
  load() { const r = this.db.prepare('SELECT body FROM snapshot WHERE id = 1').get() as { body: string } | undefined; return r ? JSON.parse(r.body) : null; }
  save(snapshot: unknown) { this.db.prepare('INSERT INTO snapshot(id, body, saved_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body, saved_at = excluded.saved_at').run(JSON.stringify(snapshot), Date.now()); }
  appendEvent(e: OrderEvent) { this.db.prepare('INSERT OR IGNORE INTO order_events(id, order_id, type, version, at, data) VALUES (?,?,?,?,?,?)').run(e.id, e.orderId, e.type, e.version, e.at, e.data ? JSON.stringify(e.data) : null); }
  eventsFor(orderId: string) { return this.db.prepare('SELECT id, type, version, at, data FROM order_events WHERE order_id = ? ORDER BY id').all(orderId); }
  close() { this.db.close(); }
}

/** Debounced saver: persists soon after any change, and at least every `maxMs`. Call flush() on shutdown. */
export function autosave(engine: { snapshot(): unknown; on(l: (e: OrderEvent) => void): () => void }, store: SnapshotStore, debounceMs = 400) {
  let timer: ReturnType<typeof setTimeout> | undefined; let dirty = false;
  const flush = () => { if (timer) clearTimeout(timer); timer = undefined; if (!dirty) return; dirty = false; store.save(engine.snapshot()); };
  const off = engine.on(e => { try { store.appendEvent(e); } catch (x) { console.error('event log write failed', x); } dirty = true; if (!timer) timer = setTimeout(flush, debounceMs); });
  return { flush, stop: () => { off(); flush(); } };
}
