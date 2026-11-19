import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { supabase } from '../lib/supabase';
import { isConfigured } from '../lib/config';
import { secureDelete, secureGet, secureSet } from './secureStorage';
import { deviceLabel, getDeviceId } from './deviceId';
import { decide, friendlyAuthError, HEARTBEAT_MS, type Decision, type Heartbeat, type LockReason, type ServerStatus } from './sessionPolicy';

export interface AppUser { id: string; email: string; role: 'owner' | 'user'; displayName?: string }
export type Access =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'locked'; reason: LockReason }
  | { status: 'active'; user: AppUser; offline: boolean };

interface AuthApi {
  access: Access;
  configured: boolean;
  checkInvite(code: string): Promise<boolean>;
  signUp(p: { code: string; email: string; password: string; name?: string }): Promise<{ ok: boolean; message?: string; needsEmailConfirmation?: boolean }>;
  signIn(email: string, password: string): Promise<{ ok: boolean; message?: string }>;
  signOut(): Promise<void>;
  requestReset(email: string): Promise<{ ok: boolean; message?: string }>;
  confirmReset(email: string, token: string, newPassword: string): Promise<{ ok: boolean; message?: string }>;
  /** à appeler quand une requête serveur est refusée (RLS) pour forcer une vérification immédiate */
  recheck(): Promise<void>;
  /** depuis l'écran « session terminée » : revenir à la connexion */
  acknowledgeLock(): void;
}
const Ctx = createContext<AuthApi | null>(null);
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('AuthProvider manquant'); return c; };

const K_VALIDATED = 'primal.last_validated';
const K_CLOCK = 'primal.max_clock';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<Access>({ status: 'loading' });
  const busy = useRef(false);
  const accessRef = useRef<Access>({ status: 'loading' });
  useEffect(() => { accessRef.current = access; }, [access]);

  const readCtx = async () => {
    const [v, c] = await Promise.all([secureGet(K_VALIDATED), secureGet(K_CLOCK)]);
    const now = Date.now();
    return { now, lastValidatedAt: v ? Number(v) : null, maxClockSeen: c ? Number(c) : null };
  };

  const loadProfile = async (): Promise<AppUser | null> => {
    const { data, error } = await supabase.rpc('my_profile');
    if (error || !data) return null;
    return { id: data.id, email: data.email, role: data.role, displayName: data.display_name ?? undefined };
  };

  const heartbeat = useCallback(async (): Promise<Heartbeat> => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      // Session locale disparue alors qu'elle avait été validée (refresh refusé après révocation) => appareil révoqué
      return (await secureGet(K_VALIDATED)) ? { kind: 'auth_rejected' } : { kind: 'server', status: 'none' };
    }
    const net = await Network.getNetworkStateAsync().catch(() => null);
    if (net && net.isInternetReachable === false) return { kind: 'network_error' };
    const { data, error } = await supabase.rpc('session_status');
    if (error) {
      if (/jwt|401|403|not authenticated/i.test(error.message) || (error as any).status === 401) return { kind: 'auth_rejected' };
      return { kind: 'network_error' };
    }
    return { kind: 'server', status: data as ServerStatus };
  }, []);

  const apply = useCallback(async (d: Decision) => {
    if (d.action === 'allow') {
      const user = await loadProfile();
      if (!user) { setAccess((a) => (a.status === 'active' ? a : { status: 'signedOut' })); return; }
      const now = Date.now();
      if (!d.offline) { await secureSet(K_VALIDATED, String(now)); await secureSet(K_CLOCK, String(now)); }
      setAccess({ status: 'active', user, offline: d.offline });
    } else if (d.action === 'lock') {
      // Verrouillage réel : on supprime la session locale (jetons) et on bloque l'accès aux données.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      await secureDelete(K_VALIDATED);
      setAccess({ status: 'locked', reason: d.reason });
    } else if (d.action === 'signout') {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setAccess({ status: 'signedOut' });
    } else if (d.action === 'claim') {
      const ok = await claim();
      if (ok) await apply({ action: 'allow', offline: false });
      else setAccess({ status: 'locked', reason: 'revoked' });
    }
  }, []);

  const claim = async (): Promise<boolean> => {
    const id = await getDeviceId();
    const { label, platform } = deviceLabel();
    const { error } = await supabase.rpc('claim_device', { p_device_id: id, p_label: label, p_platform: platform });
    if (!error) { const now = Date.now(); await secureSet(K_VALIDATED, String(now)); await secureSet(K_CLOCK, String(now)); }
    return !error;
  };

  const check = useCallback(async () => {
    if (!isConfigured || busy.current || accessRef.current.status === 'locked') return;
    busy.current = true;
    try {
      const hb = await heartbeat();
      const { data: s } = await supabase.auth.getSession();
      await apply(decide(hb, await readCtx()));
    } finally { busy.current = false; }
  }, [apply, heartbeat]);

  // démarrage + battement régulier + retour au premier plan
  useEffect(() => {
    if (!isConfigured) { setAccess({ status: 'signedOut' }); return; }
    void check();
    const t = setInterval(() => { if (AppState.currentState === 'active') void check(); }, HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void check(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [check]);

  const api = useMemo<AuthApi>(() => ({
    access, configured: isConfigured,
    async checkInvite(code) {
      const { data, error } = await supabase.rpc('check_invite_code', { p_code: code });
      return !error && data === true;
    },
    async signUp({ code, email, password, name }) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { invite_code: code, display_name: name } } });
      if (error) return { ok: false, message: friendlyAuthError(error.message, 'signup') };
      if (!data.session) return { ok: true, needsEmailConfirmation: true };
      if (!(await claim())) return { ok: false, message: 'Impossible d’enregistrer cet appareil.' };
      if (name) await supabase.from('profiles').update({ display_name: name }).eq('id', data.user!.id);
      await apply({ action: 'allow', offline: false });
      return { ok: true };
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return { ok: false, message: friendlyAuthError(error.message, 'signin') };
      // Prend la place de l'ancien appareil : le serveur révoque son ancienne session.
      const id = await getDeviceId();
      const { label, platform } = deviceLabel();
      const { error: e2 } = await supabase.rpc('claim_device', { p_device_id: id, p_label: label, p_platform: platform });
      if (e2) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        return { ok: false, message: friendlyAuthError(e2.message, 'signin') };
      }
      await secureSet(K_VALIDATED, String(Date.now()));
      await apply({ action: 'allow', offline: false });
      return { ok: true };
    },
    async signOut() {
      await supabase.rpc('release_device').then(() => {}, () => {});
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      await secureDelete(K_VALIDATED);
      setAccess({ status: 'signedOut' });
    },
    async requestReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      return error ? { ok: false, message: friendlyAuthError(error.message) } : { ok: true };
    },
    async confirmReset(email, token, newPassword) {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'recovery' });
      if (error) return { ok: false, message: 'Code invalide ou expiré.' };
      const { error: e2 } = await supabase.auth.updateUser({ password: newPassword });
      if (e2) { await supabase.auth.signOut({ scope: 'local' }).catch(() => {}); return { ok: false, message: friendlyAuthError(e2.message) }; }
      if (!(await claim())) return { ok: false, message: 'Impossible d’enregistrer cet appareil.' };
      await apply({ action: 'allow', offline: false });
      return { ok: true };
    },
    recheck: check,
    acknowledgeLock: () => setAccess({ status: 'signedOut' }),
  }), [access, apply, check]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
