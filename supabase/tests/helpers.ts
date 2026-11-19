import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOST = process.env.PG_TEST_DIR ?? '/tmp/primal-pg';
const PORT = 54399;
const root = join(__dirname, '..');

export type Claims = { sub: string; session_id: string; role?: string };

export async function connect(database = 'postgres'): Promise<Client> {
  const c = new Client({ host: HOST, port: PORT, user: 'postgres', database });
  await c.connect();
  return c;
}

export async function pgAvailable(): Promise<boolean> {
  try { const c = await connect(); await c.end(); return true; } catch { return false; }
}

export async function freshDb(name: string): Promise<Client> {
  const adm = await connect();
  await adm.query(`drop database if exists ${name}`);
  await adm.query(`create database ${name}`);
  await adm.end();
  // Les rôles sont globaux au cluster : créés une seule fois par le stub (tolérer l'existence).
  const c = await connect(name);
  const stub = readFileSync(join(root, 'tests/auth_stub.sql'), 'utf8')
    .replace(/create role (\w+) nologin( bypassrls)?;/g,
      (_m, r, b) => `do $$ begin create role ${r} nologin${b ?? ''}; exception when duplicate_object then null; end $$;`);
  await c.query(stub);
  await c.query(readFileSync(join(root, 'migrations/0001_security.sql'), 'utf8'));
  await c.query(readFileSync(join(root, 'migrations/0002_sync.sql'), 'utf8'));
  return c;
}

/** Exécute une requête "comme" un utilisateur authentifié PostgREST (rôle + claims JWT). */
export async function as<T = any>(db: string, claims: Claims | null, sql: string, params: any[] = []): Promise<T[]> {
  const c = await connect(db);
  try {
    await c.query('begin');
    await c.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify({ role: 'authenticated', ...claims }) : '{}']);
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows as T[];
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}
