-- =====================================================================
-- PRIMAL SCAN — 0001 : sécurité (invitations, propriétaire, appareil unique)
-- À exécuter UNE FOIS dans Supabase > SQL Editor (rôle postgres).
-- =====================================================================
-- Principes :
--  * Aucune table sensible n'est accessible directement : tout passe par des
--    fonctions SECURITY DEFINER qui vérifient l'identité et la session.
--  * Le rôle (owner/user) vit UNIQUEMENT dans public.profiles, jamais dans
--    les métadonnées modifiables par l'utilisateur.
--  * Les codes d'invitation ne sont jamais stockés en clair (hash + poivre).
--  * Un seul appareil actif par compte : public.device_sessions (1 ligne / user).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Configuration interne (poivre des hash, e-mail du propriétaire)
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;

insert into public.app_config(key, value)
values ('invite_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'user' check (role in ('owner','user')),
  status       text not null default 'active' check (status in ('active','disabled')),
  created_at   timestamptz not null default now()
);
-- Un seul propriétaire possible
create unique index if not exists profiles_single_owner on public.profiles(role) where role = 'owner';
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id            uuid primary key default gen_random_uuid(),
  code_hash     text not null unique,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,                       -- null = sans expiration
  status        text not null default 'available' check (status in ('available','used','revoked')),
  used_by       uuid,                              -- pas de FK : conserver l'historique
  used_by_email text,
  used_at       timestamptz,
  revoked_at    timestamptz
);
alter table public.invitations enable row level security;

-- ---------------------------------------------------------------------
-- Appareil actif (UNE ligne par compte => un seul appareil actif)
-- ---------------------------------------------------------------------
create table if not exists public.device_sessions (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  device_id      text not null,
  session_id     uuid not null,                    -- session Supabase (claim session_id du JWT)
  platform       text,
  device_label   text,
  status         text not null default 'active' check (status in ('active','revoked')),
  logged_in_at   timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_reason text
);
alter table public.device_sessions enable row level security;

create table if not exists public.security_events (
  id      bigserial primary key,
  user_id uuid,
  kind    text not null,
  detail  jsonb not null default '{}'::jsonb,
  at      timestamptz not null default now()
);
alter table public.security_events enable row level security;

-- ---------------------------------------------------------------------
-- Helpers internes
-- ---------------------------------------------------------------------
create or replace function public._hash_invite(p_code text)
returns text language sql stable security definer
set search_path = public, extensions, pg_temp as $$
  select encode(
    extensions.digest(
      (select value from public.app_config where key = 'invite_pepper')
        || upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')),
      'sha256'),
    'hex')
$$;

create or replace function public._generate_invite_code()
returns text language plpgsql volatile security definer
set search_path = public, extensions, pg_temp as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 symboles, sans 0/O/1/I
  b bytea := extensions.gen_random_bytes(12);
  s text := '';
  i int;
begin
  for i in 0..11 loop
    s := s || substr(alphabet, (get_byte(b, i) & 31) + 1, 1); -- 256 % 32 = 0 : pas de biais
  end loop;
  return 'PRIMAL-' || substr(s,1,4) || '-' || substr(s,5,4) || '-' || substr(s,9,4);
end $$;

create or replace function public._is_owner_bootstrap(p_email text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (select 1 from public.app_config
                  where key = 'owner_email' and value = lower(coalesce(p_email, '')))
     and not exists (select 1 from public.profiles where role = 'owner')
$$;

-- Session valide = appareil actif + même session que le JWT + compte actif.
create or replace function public.is_active_session()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
      from public.device_sessions d
      join public.profiles p on p.id = d.user_id
     where d.user_id    = auth.uid()
       and d.status     = 'active'
       and d.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and p.status     = 'active')
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_active_session()
     and exists (select 1 from public.profiles
                  where id = auth.uid() and role = 'owner' and status = 'active')
$$;

-- ---------------------------------------------------------------------
-- INSCRIPTION : seuls les codes valides (ou le propriétaire initial) passent
-- ---------------------------------------------------------------------
create or replace function public.check_invite_code(p_code text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.invitations
     where code_hash = public._hash_invite(p_code)
       and status = 'available'
       and (expires_at is null or expires_at > now()))
$$;

create or replace function public._before_user_created()
returns trigger language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  v_code text := new.raw_user_meta_data ->> 'invite_code';
  v_inv  uuid;
begin
  if public._is_owner_bootstrap(new.email) then
    -- Compte propriétaire initial : pas de code, profil créé en AFTER INSERT.
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'invite_code';
    return new;
  end if;

  -- Consommation ATOMIQUE : un seul UPDATE conditionnel. Deux inscriptions
  -- simultanées avec le même code : la 2e attend le verrou de ligne, relit
  -- status='used', ne trouve rien et échoue. Si l'INSERT du user échoue
  -- ensuite, toute la transaction est annulée et le code redevient libre.
  update public.invitations
     set status = 'used', used_at = now(), used_by = new.id, used_by_email = new.email
   where code_hash = public._hash_invite(v_code)
     and status = 'available'
     and (expires_at is null or expires_at > now())
  returning id into v_inv;

  if v_inv is null then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'invite_code';
  return new;
end $$;

create or replace function public._after_user_created()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles(id, email, role)
  values (new.id, new.email,
          case when public._is_owner_bootstrap(new.email) then 'owner' else 'user' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists primal_before_user_created on auth.users;
create trigger primal_before_user_created before insert on auth.users
  for each row execute function public._before_user_created();

drop trigger if exists primal_after_user_created on auth.users;
create trigger primal_after_user_created after insert on auth.users
  for each row execute function public._after_user_created();

-- ---------------------------------------------------------------------
-- PROPRIÉTAIRE : à lancer par vous dans le SQL Editor (postgres uniquement)
-- ---------------------------------------------------------------------
create or replace function public.setup_owner(p_email text)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'OWNER_ALREADY_EXISTS';
  end if;
  insert into public.app_config(key, value) values ('owner_email', lower(p_email))
  on conflict (key) do update set value = excluded.value;
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is not null then
    insert into public.profiles(id, email, role) values (v_id, lower(p_email), 'owner')
    on conflict (id) do update set role = 'owner';
    return 'Compte existant promu propriétaire.';
  end if;
  return 'Propriétaire enregistré : créez maintenant le compte avec cet e-mail.';
end $$;

-- ---------------------------------------------------------------------
-- APPAREIL UNIQUE
-- ---------------------------------------------------------------------
-- Appelée juste après chaque connexion. Atomique : verrou sur la ligne profil.
create or replace function public.claim_device(p_device_id text, p_label text default null, p_platform text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  p   public.profiles;
  d   public.device_sessions;
  v_replaced boolean := false;
begin
  if uid is null or sid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_device_id is null or length(p_device_id) < 8 then raise exception 'BAD_DEVICE'; end if;

  -- Sérialise toutes les connexions concurrentes du même compte.
  select * into p from public.profiles where id = uid for update;
  if not found then raise exception 'NO_PROFILE'; end if;

  if p.status = 'disabled' then
    delete from auth.sessions where user_id = uid;
    raise exception 'ACCOUNT_DISABLED';
  end if;

  -- Une session déjà supprimée (ancien appareil, jeton encore "frais")
  -- ne doit JAMAIS pouvoir reprendre la place.
  if not exists (select 1 from auth.sessions where id = sid and user_id = uid) then
    raise exception 'SESSION_REVOKED';
  end if;

  select * into d from public.device_sessions where user_id = uid for update;
  if found and d.session_id = sid and d.status = 'revoked' then
    raise exception 'SESSION_REVOKED';
  end if;

  v_replaced := found and d.status = 'active' and d.session_id <> sid;

  insert into public.device_sessions(user_id, device_id, session_id, platform, device_label,
                                     status, logged_in_at, last_seen_at, revoked_at, revoked_reason)
  values (uid, p_device_id, sid, p_platform, p_label, 'active', now(), now(), null, null)
  on conflict (user_id) do update
    set device_id = excluded.device_id, session_id = excluded.session_id,
        platform = excluded.platform, device_label = excluded.device_label,
        status = 'active', logged_in_at = case when public.device_sessions.session_id = excluded.session_id
                                               then public.device_sessions.logged_in_at else now() end,
        last_seen_at = now(), revoked_at = null, revoked_reason = null;

  -- Révocation réelle des anciennes sessions : leurs refresh tokens disparaissent.
  delete from auth.sessions where user_id = uid and id <> sid;

  if v_replaced then
    insert into public.security_events(user_id, kind, detail)
    values (uid, 'device_replaced', jsonb_build_object('previous_device', left(d.device_id, 6), 'new_device', left(p_device_id, 6)));
  end if;
  return jsonb_build_object('status', 'ok', 'replaced', v_replaced);
end $$;

-- Battement de coeur / vérification : active | revoked | disabled | unclaimed | none
create or replace function public.session_status()
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  p public.profiles;
  d public.device_sessions;
begin
  if uid is null then return 'none'; end if;
  select * into p from public.profiles where id = uid;
  if not found then return 'none'; end if;
  if p.status = 'disabled' then return 'disabled'; end if;
  select * into d from public.device_sessions where user_id = uid;
  if not found then return 'unclaimed'; end if;
  if d.status = 'active' and d.session_id = sid then
    if d.last_seen_at < now() - interval '30 seconds' then
      update public.device_sessions set last_seen_at = now() where user_id = uid;
    end if;
    return 'active';
  end if;
  return 'revoked';
end $$;

create or replace function public.my_profile()
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select to_jsonb(x) from (
    select id, email, display_name, role, status from public.profiles where id = auth.uid()
  ) x
$$;

-- Déconnexion volontaire : libère la place.
create or replace function public.release_device()
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update public.device_sessions
     set status = 'revoked', revoked_at = now(), revoked_reason = 'logout'
   where user_id = auth.uid()
     and session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid;
end $$;

-- ---------------------------------------------------------------------
-- ADMINISTRATION (propriétaire uniquement)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_invitation(
  p_expiry text default '7d', p_custom timestamptz default null, p_note text default null)
returns table(id uuid, code text, expires_at timestamptz)
language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  v_exp timestamptz;
  v_code text;
  v_id uuid;
begin
  if not public.is_owner() then raise exception 'FORBIDDEN'; end if;
  v_exp := case p_expiry
    when 'none'   then null
    when '24h'    then now() + interval '24 hours'
    when '7d'     then now() + interval '7 days'
    when '30d'    then now() + interval '30 days'
    when 'custom' then p_custom
    else null end;
  if p_expiry not in ('none','24h','7d','30d','custom') then raise exception 'BAD_EXPIRY'; end if;
  if p_expiry = 'custom' and (p_custom is null or p_custom <= now()) then raise exception 'BAD_EXPIRY'; end if;

  v_code := public._generate_invite_code();
  insert into public.invitations(code_hash, note, created_by, expires_at)
  values (public._hash_invite(v_code), p_note, auth.uid(), v_exp)
  returning invitations.id into v_id;
  -- Le code en clair n'est renvoyé qu'ici, une seule fois.
  return query select v_id, v_code, v_exp;
end $$;

create or replace function public.admin_list_invitations()
returns table(id uuid, note text, created_at timestamptz, expires_at timestamptz,
              status text, used_at timestamptz, used_by_email text, revoked_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_owner() then raise exception 'FORBIDDEN'; end if;
  return query
    select i.id, i.note, i.created_at, i.expires_at,
           case when i.status = 'available' and i.expires_at is not null and i.expires_at <= now()
                then 'expired' else i.status end,
           i.used_at, i.used_by_email, i.revoked_at
      from public.invitations i order by i.created_at desc;
end $$;

create or replace function public.admin_revoke_invitation(p_id uuid)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare n int;
begin
  if not public.is_owner() then raise exception 'FORBIDDEN'; end if;
  update public.invitations set status = 'revoked', revoked_at = now()
   where id = p_id and status = 'available';
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.admin_list_devices()
returns table(user_id uuid, email text, display_name text, role text, account_status text,
              device_label text, platform text, device_short text,
              logged_in_at timestamptz, last_seen_at timestamptz, session_status text)
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_owner() then raise exception 'FORBIDDEN'; end if;
  return query
    select p.id, p.email, p.display_name, p.role, p.status,
           d.device_label, d.platform, left(d.device_id, 6),
           d.logged_in_at, d.last_seen_at, coalesce(d.status, 'none')
      from public.profiles p left join public.device_sessions d on d.user_id = p.id
     order by p.created_at;
end $$;

create or replace function public.admin_revoke_session(p_user uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_owner() then raise exception 'FORBIDDEN'; end if;
  update public.device_sessions
     set status = 'revoked', revoked_at = now(), revoked_reason = 'admin'
   where user_id = p_user;
  delete from auth.sessions where user_id = p_user;
  insert into public.security_events(user_id, kind) values (p_user, 'admin_revoked');
end $$;

create or replace function public.admin_set_account_status(p_user uuid, p_disabled boolean)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_owner() then raise exception 'FORBIDDEN'; end if;
  if p_user = auth.uid() then raise exception 'CANNOT_DISABLE_SELF'; end if;
  update public.profiles set status = case when p_disabled then 'disabled' else 'active' end
   where id = p_user;
  if p_disabled then
    update public.device_sessions set status = 'revoked', revoked_at = now(), revoked_reason = 'disabled'
     where user_id = p_user;
    delete from auth.sessions where user_id = p_user;
  end if;
  insert into public.security_events(user_id, kind, detail)
  values (p_user, 'account_status', jsonb_build_object('disabled', p_disabled));
end $$;

-- ---------------------------------------------------------------------
-- PERMISSIONS : tout fermé par défaut, ouverture explicite
-- ---------------------------------------------------------------------
revoke all on public.app_config, public.invitations, public.device_sessions,
              public.security_events, public.profiles from anon, authenticated;

-- Profil : lecture de sa ligne (session active requise) + modification du seul display_name
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() and public.is_active_session());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_session())
  with check (id = auth.uid());

-- Fonctions : retirer l'exécution publique puis accorder au cas par cas
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('_hash_invite','_generate_invite_code','_is_owner_bootstrap',
                'is_active_session','is_owner','check_invite_code','_before_user_created',
                '_after_user_created','setup_owner','claim_device','session_status','my_profile',
                'release_device','admin_create_invitation','admin_list_invitations',
                'admin_revoke_invitation','admin_list_devices','admin_revoke_session',
                'admin_set_account_status')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function public.check_invite_code(text)               to anon, authenticated;
grant execute on function public.is_active_session()                   to authenticated;
grant execute on function public.is_owner()                            to authenticated;
grant execute on function public.claim_device(text, text, text)        to authenticated;
grant execute on function public.session_status()                      to authenticated;
grant execute on function public.my_profile()                          to authenticated;
grant execute on function public.release_device()                      to authenticated;
grant execute on function public.admin_create_invitation(text, timestamptz, text) to authenticated;
grant execute on function public.admin_list_invitations()              to authenticated;
grant execute on function public.admin_revoke_invitation(uuid)         to authenticated;
grant execute on function public.admin_list_devices()                  to authenticated;
grant execute on function public.admin_revoke_session(uuid)            to authenticated;
grant execute on function public.admin_set_account_status(uuid, boolean) to authenticated;
-- setup_owner : aucun grant => uniquement postgres (SQL Editor)
