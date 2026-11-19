import type { Db } from './types';

/**
 * Tables synchronisables : même forme (id, updated_at ms, deleted, dirty) + colonnes d'index.
 * `dirty = 1` => modifié localement et pas encore envoyé au serveur.
 */
export interface SyncTable { entity: string; table: string; columns: string[] }
export const SYNC_TABLES: SyncTable[] = [
  { entity: 'entry', table: 'entries', columns: ['date', 'meal_type', 'status', 'data'] },
  { entity: 'recipe', table: 'recipes', columns: ['name', 'data'] },
  { entity: 'favorite', table: 'favorites', columns: ['data'] },
  { entity: 'setting', table: 'settings', columns: ['data'] },
  { entity: 'food', table: 'foods', columns: ['name_norm', 'barcode', 'source', 'data', 'last_used'] },
];

const MIGRATIONS: string[] = [
  `
  create table entries (
    id text primary key, date text not null, meal_type text not null, status text not null default 'eaten',
    data text not null, updated_at integer not null, deleted integer not null default 0, dirty integer not null default 1);
  create index entries_date on entries(date, deleted);
  create table recipes (
    id text primary key, name text not null, data text not null,
    updated_at integer not null, deleted integer not null default 0, dirty integer not null default 1);
  create table favorites (
    id text primary key, data text not null,
    updated_at integer not null, deleted integer not null default 0, dirty integer not null default 1);
  create table settings (
    id text primary key, data text not null,
    updated_at integer not null, deleted integer not null default 0, dirty integer not null default 1);
  create table foods (
    id text primary key, name_norm text not null, barcode text, source text not null, data text not null,
    last_used integer, updated_at integer not null, deleted integer not null default 0, dirty integer not null default 1);
  create index foods_barcode on foods(barcode);
  create index foods_name on foods(name_norm);
  create table sync_state (key text primary key, value text not null);
  `,
];

export async function migrate(db: Db): Promise<void> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[v]);
      await db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
