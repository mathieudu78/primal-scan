import { DatabaseSync } from 'node:sqlite';
import type { Db, SqlValue } from '../types';

export function openMemoryDb(): Db {
  const db = new DatabaseSync(':memory:');
  let depth = 0;
  return {
    async exec(sql) { db.exec(sql); },
    async run(sql, p: SqlValue[] = []) { const r = db.prepare(sql).run(...p); return { changes: Number(r.changes) }; },
    async all(sql, p: SqlValue[] = []) { return db.prepare(sql).all(...p) as any[]; },
    async get(sql, p: SqlValue[] = []) { return db.prepare(sql).get(...p) as any; },
    async transaction(fn) {
      if (depth > 0) return fn();
      depth++;
      try { db.exec('BEGIN'); const r = await fn(); db.exec('COMMIT'); return r; }
      catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
      finally { depth--; }
    },
    async close() { db.close(); },
  };
}
