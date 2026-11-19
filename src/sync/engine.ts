import type { Db } from '../db/types';
import { SYNC_TABLES } from '../db/schema';

export interface RemoteRecord { entity: string; id: string; data: Record<string, any>; updated_at: string; deleted: boolean; server_updated_at?: string }
/** Côté serveur (Supabase) — remplaçable par un faux dans les tests. */
export interface Remote {
  push(records: RemoteRecord[]): Promise<void>;
  pull(sinceIso: string | null): Promise<RemoteRecord[]>;
}
export class SessionRevokedError extends Error {}

const CURSOR = 'pull_cursor';
const OVERLAP_MS = 5000;

export interface SyncResult { pushed: number; pulled: number; applied: number }

/**
 * Synchronisation "dernier écrit gagne" (horloge client) :
 *  1. récupère les changements du serveur et les applique s'ils sont plus récents  2. envoie les lignes `dirty=1` restantes.
 * Si le serveur refuse (session révoquée), l'erreur remonte et la synchro s'arrête.
 */
export async function syncOnce(db: Db, remote: Remote): Promise<SyncResult> {
  let pushed = 0, pulled = 0, applied = 0;

  const cursorRow = await db.get<{ value: string }>('select value from sync_state where key=?', [CURSOR]);
  const since = cursorRow ? new Date(new Date(cursorRow.value).getTime() - OVERLAP_MS).toISOString() : null;
  const incoming = await remote.pull(since);
  pulled = incoming.length;
  let maxServer = cursorRow?.value ?? null;

  await db.transaction(async () => {
    for (const rec of incoming) {
      const t = SYNC_TABLES.find((x) => x.entity === rec.entity);
      if (!t) continue; // entité inconnue : ignorée (version d'app plus ancienne)
      if (rec.server_updated_at && (!maxServer || rec.server_updated_at > maxServer)) maxServer = rec.server_updated_at;
      const remoteMs = new Date(rec.updated_at).getTime();
      const local = await db.get<{ updated_at: number }>(`select updated_at from ${t.table} where id=?`, [rec.id]);
      if (local && local.updated_at >= remoteMs) continue; // local plus récent (ou identique)
      const cols = ['id', ...t.columns, 'updated_at', 'deleted', 'dirty'];
      const vals = [rec.id, ...t.columns.map((c) => (rec.data[c] ?? null)), remoteMs, rec.deleted ? 1 : 0, 0];
      await db.run(`insert or replace into ${t.table}(${cols.join(',')}) values (${cols.map(() => '?').join(',')})`, vals as any);
      applied++;
    }
    if (maxServer) await db.run('insert or replace into sync_state(key,value) values (?,?)', [CURSOR, maxServer]);
  });
  for (const t of SYNC_TABLES) {
    const rows = await db.all<any>(`select * from ${t.table} where dirty=1`);
    if (!rows.length) continue;
    const records: RemoteRecord[] = rows.map((r) => ({
      entity: t.entity, id: r.id, deleted: !!r.deleted, updated_at: new Date(r.updated_at).toISOString(),
      data: Object.fromEntries(t.columns.map((c) => [c, r[c]])),
    }));
    for (let i = 0; i < records.length; i += 200) await remote.push(records.slice(i, i + 200));
    // n'efface le drapeau que si la ligne n'a pas été modifiée pendant l'envoi
    for (const r of rows) await db.run(`update ${t.table} set dirty=0 where id=? and updated_at=?`, [r.id, r.updated_at]);
    pushed += rows.length;
  }
  return { pushed, pulled, applied };
}

export async function pendingCount(db: Db): Promise<number> {
  let n = 0;
  for (const t of SYNC_TABLES) n += (await db.get<{ c: number }>(`select count(*) c from ${t.table} where dirty=1`))!.c;
  return n;
}
