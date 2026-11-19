import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { openExpoDb } from '../db/expoDb';
import { migrate } from '../db/schema';
import { Repo, type UserSettings } from '../db/repo';
import type { Db } from '../db/types';
import { supabase } from '../lib/supabase';
import { pendingCount, SessionRevokedError, syncOnce } from '../sync/engine';
import { supabaseRemote } from '../sync/supabaseRemote';

interface DataApi {
  repo: Repo;
  settings: UserSettings;
  /** incrémenté à chaque modification : les écrans l'utilisent pour se rafraîchir */
  version: number;
  changed(): void;
  saveSettings(s: UserSettings): Promise<void>;
  sync: { pending: number; lastSyncAt: number | null; error: string | null; syncNow(): Promise<void> };
}
const Ctx = createContext<DataApi | null>(null);
export const useData = () => { const c = useContext(Ctx); if (!c) throw new Error('AppData manquant'); return c; };

/**
 * N'existe que lorsque la session est ACTIVE : à la perte de l'autorisation, le composant est démonté,
 * la base est fermée et plus aucune donnée privée n'est accessible ni synchronisée.
 */
export function AppDataProvider({ userId, offline, children }: { userId: string; offline: boolean; children: React.ReactNode }) {
  const auth = useAuth();
  const [ready, setReady] = useState<{ db: Db; repo: Repo } | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncing = useRef(false);
  const offlineRef = useRef(offline);
  offlineRef.current = offline;

  useEffect(() => {
    let closed: Db | null = null, cancelled = false;
    (async () => {
      const db = await openExpoDb(userId);
      await migrate(db);
      if (cancelled) { await db.close(); return; }
      closed = db;
      const repo = new Repo(db);
      setSettings(await repo.getSettings());
      setReady({ db, repo });
    })();
    return () => { cancelled = true; void closed?.close(); setReady(null); setSettings(null); };
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!ready || syncing.current || offlineRef.current) return;
    syncing.current = true;
    try {
      const r = await syncOnce(ready.db, supabaseRemote(supabase, userId));
      setLastSyncAt(Date.now()); setError(null);
      if (r.applied > 0) { setSettings(await ready.repo.getSettings()); setVersion((v) => v + 1); }
    } catch (e: any) {
      if (e instanceof SessionRevokedError) void auth.recheck(); // le serveur a refusé : vérifier/verrouiller immédiatement
      else setError(e?.message ?? 'Synchronisation impossible');
    } finally {
      syncing.current = false;
      if (ready) setPending(await pendingCount(ready.db));
    }
  }, [ready, userId, auth]);

  useEffect(() => {
    if (!ready) return;
    void syncNow();
    const t = setInterval(() => { if (AppState.currentState === 'active') void syncNow(); }, 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void syncNow(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [ready, syncNow]);

  const changed = useCallback(() => {
    setVersion((v) => v + 1);
    if (ready) void pendingCount(ready.db).then(setPending);
    // envoi différé après une série de modifications
    setTimeout(() => void syncNow(), 3000);
  }, [ready, syncNow]);

  const saveSettings = useCallback(async (s: UserSettings) => {
    if (!ready) return;
    await ready.repo.saveSettings(s); setSettings(s); changed();
  }, [ready, changed]);

  const value = useMemo(() => (ready && settings ? { repo: ready.repo, settings, version, changed, saveSettings, sync: { pending, lastSyncAt, error, syncNow } } : null),
    [ready, settings, version, changed, saveSettings, pending, lastSyncAt, error, syncNow]);
  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
