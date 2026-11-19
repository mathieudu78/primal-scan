-- =====================================================================
-- PRIMAL SCAN — 0002 : synchronisation des données privées
-- Chaque enregistrement local (repas, recettes, favoris, objectifs...) est
-- stocké ici sous forme JSON, isolé par utilisateur, ET réservé à
-- l'appareil/la session actifs (RLS + is_active_session()).
-- =====================================================================

create table if not exists public.sync_records (
  user_id           uuid not null references auth.users(id) on delete cascade,
  entity            text not null,
  id                text not null,
  data              jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null,           -- horloge du client (dernier écrit gagne)
  deleted           boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, entity, id)
);
create index if not exists sync_records_pull on public.sync_records(user_id, server_updated_at);
alter table public.sync_records enable row level security;

create or replace function public._sync_touch()
returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  new.user_id := coalesce(new.user_id, auth.uid());
  return new;
end $$;
drop trigger if exists sync_touch on public.sync_records;
create trigger sync_touch before insert or update on public.sync_records
  for each row execute function public._sync_touch();

revoke all on public.sync_records from anon, authenticated;
grant select, insert, update, delete on public.sync_records to authenticated;

drop policy if exists sync_own on public.sync_records;
create policy sync_own on public.sync_records for all to authenticated
  using (user_id = auth.uid() and public.is_active_session())
  with check (user_id = auth.uid() and public.is_active_session());
