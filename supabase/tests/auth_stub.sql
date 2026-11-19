-- Simulation minimale du schéma Supabase pour tester nos migrations hors Supabase.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions;
grant usage on schema auth, extensions, public to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique, raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create table auth.sessions (id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz default now());
create function auth.jwt() returns jsonb language sql stable as
 $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
 $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
