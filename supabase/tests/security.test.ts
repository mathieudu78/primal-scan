import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { as, connect, freshDb, pgAvailable, type Claims } from './helpers';

const DB = 'primal_sec_test';
const ok = await pgAvailable();
let adm: Client;
const OWNER_EMAIL = 'owner@example.com';

async function signup(email: string, code?: string): Promise<string> {
  const meta = code ? { invite_code: code } : {};
  const r = await adm.query(`insert into auth.users(email, raw_user_meta_data) values ($1,$2) returning id`, [email, meta]);
  return r.rows[0].id;
}
async function login(uid: string): Promise<Claims> {
  const r = await adm.query(`insert into auth.sessions(user_id) values ($1) returning id`, [uid]);
  return { sub: uid, session_id: r.rows[0].id };
}
const claim = (c: Claims, dev: string) =>
  as(DB, c, `select public.claim_device($1,'Test phone','ios') as r`, [dev]);

let owner: Claims;
async function newCode(expiry = '7d', custom: string | null = null): Promise<{ id: string; code: string }> {
  const r = await as(DB, owner, `select * from public.admin_create_invitation($1,$2,$3)`, [expiry, custom, 'test']);
  return r[0];
}

describe.skipIf(!ok)('Sécurité Supabase (Postgres réel)', () => {
  beforeAll(async () => {
    adm = await freshDb(DB);
    await adm.query(`select public.setup_owner($1)`, [OWNER_EMAIL]);
    const oid = await signup(OWNER_EMAIL); // propriétaire : sans code
    owner = await login(oid);
    await claim(owner, 'owner-device-1');
  });
  afterAll(async () => { await adm?.end(); });

  describe('Propriétaire', () => {
    it('le propriétaire initial reçoit le rôle owner côté serveur', async () => {
      const r = await adm.query(`select role from profiles where email=$1`, [OWNER_EMAIL]);
      expect(r.rows[0].role).toBe('owner');
    });
    it('un second compte avec l’e-mail propriétaire ne peut pas devenir owner (déjà pris)', async () => {
      await expect(signup(OWNER_EMAIL)).rejects.toThrow(); // email unique + plus de bootstrap
    });
    it('H. un utilisateur normal ne peut pas devenir administrateur', async () => {
      const { code } = await newCode();
      const uid = await signup('h@example.com', code);
      const c = await login(uid); await claim(c, 'device-h-0001');
      await expect(as(DB, c, `update profiles set role='owner' where id=$1`, [uid])).rejects.toThrow(/permission denied/);
      await expect(as(DB, c, `select * from public.admin_list_devices()`)).rejects.toThrow(/FORBIDDEN/);
      // métadonnées falsifiées à l’inscription : sans effet sur le rôle
      const { code: c2 } = await newCode();
      const u2 = await adm.query(`insert into auth.users(email, raw_user_meta_data, raw_app_meta_data)
        values ('h2@example.com', $1, '{"role":"owner"}') returning id`, [{ invite_code: c2, role: 'owner' }]);
      const p = await adm.query(`select role from profiles where id=$1`, [u2.rows[0].id]);
      expect(p.rows[0].role).toBe('user');
    });
  });

  describe('Invitations', () => {
    it('A. un code valide permet une inscription et est consommé', async () => {
      const { code } = await newCode();
      expect(code).toMatch(/^PRIMAL-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const uid = await signup('a@example.com', code);
      expect(uid).toBeTruthy();
      const p = await adm.query(`select role from profiles where id=$1`, [uid]);
      expect(p.rows[0].role).toBe('user');
      const list = await as(DB, owner, `select * from public.admin_list_invitations()`);
      expect(list.find((i: any) => i.used_by_email === 'a@example.com').status).toBe('used');
    });
    it('B. une deuxième personne ne peut pas réutiliser le même code', async () => {
      const { code } = await newCode();
      await signup('b1@example.com', code);
      await expect(signup('b2@example.com', code)).rejects.toThrow(/INVITE_INVALID/);
    });
    it('C. un code expiré est refusé', async () => {
      const { id, code } = await newCode('24h');
      await adm.query(`update invitations set expires_at = now() - interval '1 minute' where id=$1`, [id]);
      await expect(signup('c@example.com', code)).rejects.toThrow(/INVITE_INVALID/);
      const list = await as(DB, owner, `select * from public.admin_list_invitations()`);
      expect(list.find((i: any) => i.id === id).status).toBe('expired');
    });
    it('D. un code révoqué est refusé', async () => {
      const { id, code } = await newCode();
      await as(DB, owner, `select public.admin_revoke_invitation($1)`, [id]);
      await expect(signup('d@example.com', code)).rejects.toThrow(/INVITE_INVALID/);
    });
    it('E. un code inventé (ou absent) est refusé', async () => {
      await expect(signup('e1@example.com', 'PRIMAL-AAAA-BBBB-CCCC')).rejects.toThrow(/INVITE_INVALID/);
      await expect(signup('e2@example.com')).rejects.toThrow(/INVITE_INVALID/);
    });
    it('F. deux inscriptions simultanées ne consomment pas le même code', async () => {
      const { code } = await newCode();
      const c1 = await connect(DB), c2 = await connect(DB);
      const run = async (c: Client, email: string, hold: boolean) => {
        await c.query('begin');
        try {
          await c.query(`insert into auth.users(email, raw_user_meta_data) values ($1,$2)`, [email, { invite_code: code }]);
          if (hold) await c.query('select pg_sleep(1)');
          await c.query('commit');
        } catch (e) { await c.query('rollback'); throw e; }
      };
      const p1 = run(c1, 'f1@example.com', true);
      await new Promise((r) => setTimeout(r, 200));
      const p2 = run(c2, 'f2@example.com', false);
      const res = await Promise.allSettled([p1, p2]);
      await c1.end(); await c2.end();
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const n = await adm.query(`select count(*)::int n from auth.users where email in ('f1@example.com','f2@example.com')`);
      expect(n.rows[0].n).toBe(1);
    });
    it('F2. si la création du compte échoue (e-mail déjà pris), le code n’est pas brûlé', async () => {
      const { code } = await newCode();
      await expect(signup('a@example.com', code)).rejects.toThrow(); // e-mail existant
      expect(await as(DB, null, `select public.check_invite_code($1) ok`, [code]).then((r) => r[0].ok)).toBe(true);
    });
    it('G. un utilisateur normal ne peut pas créer ni lister des invitations', async () => {
      const { code } = await newCode();
      const uid = await signup('g@example.com', code);
      const c = await login(uid); await claim(c, 'device-g-0001');
      await expect(as(DB, c, `select * from public.admin_create_invitation('7d')`)).rejects.toThrow(/FORBIDDEN/);
      await expect(as(DB, c, `select * from public.admin_list_invitations()`)).rejects.toThrow(/FORBIDDEN/);
      await expect(as(DB, c, `select * from public.invitations`)).rejects.toThrow(/permission denied/);
      await expect(as(DB, c, `select public.setup_owner('g@example.com')`)).rejects.toThrow(/permission denied/);
      await expect(as(DB, null, `select * from public.invitations`)).rejects.toThrow(/permission denied/);
    });
    it('les codes ne sont jamais stockés en clair', async () => {
      const { code } = await newCode();
      const r = await adm.query(`select count(*)::int n from invitations where code_hash like '%' || $1 || '%' or note=$1`, [code.replace(/-/g, '')]);
      expect(r.rows[0].n).toBe(0);
    });
    it('durées : défaut 7j, sans expiration, personnalisée', async () => {
      const a = await newCode('7d'), b = await newCode('none'), c = await newCode('custom', new Date(Date.now() + 3 * 864e5).toISOString());
      const rows = (await as(DB, owner, `select * from public.admin_list_invitations()`));
      const exp = (id: string) => rows.find((i: any) => i.id === id).expires_at;
      expect(exp(b.id)).toBeNull();
      expect(new Date(exp(a.id)).getTime() - Date.now()).toBeGreaterThan(6.9 * 864e5);
      expect(new Date(exp(c.id)).getTime() - Date.now()).toBeGreaterThan(2.9 * 864e5);
      await expect(newCode('custom', new Date(Date.now() - 1000).toISOString())).rejects.toThrow(/BAD_EXPIRY/);
    });
  });

  describe('Appareil unique', () => {
    let uid: string, phone1: Claims, phone2: Claims;
    beforeAll(async () => {
      const { code } = await newCode();
      uid = await signup('mathieu@example.com', code);
    });

    it('I. Mathieu se connecte sur son téléphone : autorisé', async () => {
      phone1 = await login(uid);
      const r = await claim(phone1, 'iphone-mathieu-1');
      expect(r[0].r).toEqual({ status: 'ok', replaced: false });
      expect((await as(DB, phone1, `select public.session_status() s`))[0].s).toBe('active');
    });

    it('J+K+L. un 2e téléphone se connecte : le 1er est déconnecté, ses requêtes sont refusées', async () => {
      await as(DB, phone1, `insert into sync_records(user_id,entity,id,data,updated_at) values ($1,'meal','m1','{"kcal":500}',now())`, [uid]);
      phone2 = await login(uid);
      const r = await claim(phone2, 'android-ami-0001');
      expect(r[0].r.replaced).toBe(true);
      // L'ancien appareil : plus de session côté serveur...
      const left = await adm.query(`select id from auth.sessions where user_id=$1`, [uid]);
      expect(left.rows.map((x) => x.id)).toEqual([phone2.session_id]);
      // ... statut révoqué, et accès aux données privées refusé (RLS)
      expect((await as(DB, phone1, `select public.session_status() s`))[0].s).toBe('revoked');
      expect(await as(DB, phone1, `select * from sync_records`)).toHaveLength(0);
      await expect(as(DB, phone1, `insert into sync_records(user_id,entity,id,data,updated_at) values ($1,'meal','m2','{}',now())`, [uid]))
        .rejects.toThrow(/row-level security/);
      await expect(as(DB, phone1, `select * from profiles`).then((r) => { if (r.length) throw new Error('leak'); }))
        .resolves.toBeUndefined();
      // Le nouvel appareil, lui, voit les données
      expect(await as(DB, phone2, `select * from sync_records`)).toHaveLength(1);
      expect((await as(DB, phone2, `select public.session_status() s`))[0].s).toBe('active');
    });

    it('O. un ancien jeton ne peut pas reprendre la place (même encore "frais")', async () => {
      await expect(claim(phone1, 'iphone-mathieu-1')).rejects.toThrow(/SESSION_REVOKED/);
      expect((await as(DB, phone2, `select public.session_status() s`))[0].s).toBe('active');
      expect(await adm.query(`select count(*)::int n from device_sessions where user_id=$1 and status='active'`, [uid]).then((r) => r.rows[0].n)).toBe(1);
    });

    it('N. changement de téléphone possible autant de fois que nécessaire', async () => {
      let prev = phone2;
      for (let i = 0; i < 4; i++) {
        const next = await login(uid);
        await claim(next, `device-cycle-${i}-xxxx`);
        expect((await as(DB, prev, `select public.session_status() s`))[0].s).toBe('revoked');
        prev = next;
      }
      expect((await as(DB, prev, `select public.session_status() s`))[0].s).toBe('active');
      phone2 = prev;
    });

    it('M. connexions simultanées : une seule session active à la fin', async () => {
      const a = await login(uid), b = await login(uid);
      const res = await Promise.allSettled([claim(a, 'race-device-aaaa'), claim(b, 'race-device-bbbb')]);
      expect(res.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      const active = await adm.query(`select session_id from device_sessions where user_id=$1 and status='active'`, [uid]);
      expect(active.rows).toHaveLength(1);
      const sessions = await adm.query(`select id from auth.sessions where user_id=$1`, [uid]);
      expect(sessions.rows).toHaveLength(1);
      expect(sessions.rows[0].id).toBe(active.rows[0].session_id);
      // Un seul des deux reste actif
      const st = await Promise.all([a, b].map((c) => as(DB, c, `select public.session_status() s`).then((r) => r[0].s)));
      expect(st.filter((s) => s === 'active')).toHaveLength(1);
      phone2 = [a, b][st.indexOf('active')];
    });

    it('P. un appareil resté hors ligne est refusé dès sa reconnexion', async () => {
      const stale = await login(uid); await claim(stale, 'stale-device-0001');
      const newer = await login(uid); await claim(newer, 'newer-device-0001');
      // "reconnexion" de l'appareil resté hors ligne : heartbeat + sync refusés
      expect((await as(DB, stale, `select public.session_status() s`))[0].s).toBe('revoked');
      await expect(as(DB, stale, `select * from public.admin_list_devices()`)).rejects.toThrow(/FORBIDDEN/);
      expect(await as(DB, stale, `select * from sync_records`)).toHaveLength(0);
      phone2 = newer;
    });

    it('déconnexion volontaire : libère la place', async () => {
      await as(DB, phone2, `select public.release_device()`);
      expect((await as(DB, phone2, `select public.session_status() s`))[0].s).toBe('revoked');
      await expect(claim(phone2, 'newer-device-0001')).rejects.toThrow(/SESSION_REVOKED/);
    });

    it('administrateur : voit les appareils, révoque une session, désactive un compte', async () => {
      const s = await login(uid); await claim(s, 'admin-test-dev-1');
      const devs = await as(DB, owner, `select * from public.admin_list_devices()`);
      const row = devs.find((d: any) => d.email === 'mathieu@example.com');
      expect(row.session_status).toBe('active'); expect(row.platform).toBe('ios');
      await as(DB, owner, `select public.admin_revoke_session($1)`, [uid]);
      expect((await as(DB, s, `select public.session_status() s`))[0].s).toBe('revoked');
      await expect(claim(s, 'admin-test-dev-1')).rejects.toThrow(/SESSION_REVOKED/);
      // désactivation
      const s2 = await login(uid);
      await as(DB, owner, `select public.admin_set_account_status($1, true)`, [uid]);
      await expect(claim(s2, 'admin-test-dev-2')).rejects.toThrow(/SESSION_REVOKED|ACCOUNT_DISABLED/);
      expect((await as(DB, s2, `select public.session_status() s`))[0].s).toBe('disabled');
      await expect(as(DB, owner, `select public.admin_set_account_status($1, true)`, [owner.sub])).rejects.toThrow(/CANNOT_DISABLE_SELF/);
      await as(DB, owner, `select public.admin_set_account_status($1, false)`, [uid]);
    });

    it('isolation : un utilisateur ne voit jamais les données d’un autre', async () => {
      const { code } = await newCode();
      const other = await signup('other@example.com', code);
      const oc = await login(other); await claim(oc, 'other-device-001');
      expect(await as(DB, oc, `select * from sync_records`)).toHaveLength(0);
      await expect(as(DB, oc, `insert into sync_records(user_id,entity,id,data,updated_at) values ($1,'meal','x','{}',now())`, [uid]))
        .rejects.toThrow(/row-level security/);
      expect(await as(DB, null, `select 1 from sync_records`).catch(() => 'denied')).toBe('denied');
    });
  });
});
