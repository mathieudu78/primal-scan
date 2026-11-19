import type { SupabaseClient } from '@supabase/supabase-js';
import { SessionRevokedError, type Remote, type RemoteRecord } from './engine';

/** Table `sync_records` protégée par RLS : refuse tout appareil dont la session n'est plus active. */
export function supabaseRemote(sb: SupabaseClient, userId: string): Remote {
  const guard = (error: { code?: string; message: string } | null) => {
    if (!error) return;
    // 42501 = violation RLS (session révoquée), 401/403 = jeton refusé
    if (error.code === '42501' || /row-level security|JWT|not authenticated|permission denied/i.test(error.message)) throw new SessionRevokedError(error.message);
    throw new Error(error.message);
  };
  return {
    async push(records) {
      const { error } = await sb.from('sync_records').upsert(
        records.map((r) => ({ user_id: userId, entity: r.entity, id: r.id, data: r.data, updated_at: r.updated_at, deleted: r.deleted })),
        { onConflict: 'user_id,entity,id' });
      guard(error);
    },
    async pull(since) {
      const out: RemoteRecord[] = [];
      for (let from = 0; ; from += 1000) {
        let q = sb.from('sync_records').select('entity,id,data,updated_at,deleted,server_updated_at').eq('user_id', userId).order('server_updated_at').range(from, from + 999);
        if (since) q = q.gt('server_updated_at', since);
        const { data, error } = await q;
        guard(error);
        out.push(...((data ?? []) as RemoteRecord[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  };
}
