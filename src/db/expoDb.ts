import * as SQLite from 'expo-sqlite';
import type { Db, SqlValue } from './types';

/** Un fichier de base par utilisateur : les données d'un compte ne se mélangent jamais avec celles d'un autre. */
export async function openExpoDb(userId: string): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(`primal_${userId.replace(/[^a-zA-Z0-9]/g, '')}.db`);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  let depth = 0;
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => ({ changes: (await db.runAsync(sql, params)).changes }),
    all: (sql, params: SqlValue[] = []) => db.getAllAsync(sql, params) as Promise<any[]>,
    get: async (sql, params: SqlValue[] = []) => ((await db.getFirstAsync(sql, params)) ?? undefined) as any,
    async transaction(fn) {
      // pas de transactions imbriquées : la plus externe seule engage/annule
      if (depth > 0) return fn();
      depth++;
      try { await db.execAsync('BEGIN'); const r = await fn(); await db.execAsync('COMMIT'); return r; }
      catch (e) { await db.execAsync('ROLLBACK').catch(() => {}); throw e; }
      finally { depth--; }
    },
    close: () => db.closeAsync(),
  };
}
