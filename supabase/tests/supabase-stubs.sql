-- The bits of a Supabase project the migrations lean on, for a plain Postgres
-- (supabase/tests/run.sh). Not a migration: real projects already have these.
--   auth.uid() / auth.role() / auth.jwt() read request.jwt.claims, as PostgREST sets it.
do $$ begin
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end $$;

create schema auth;
create schema storage;
grant usage on schema auth, storage to anon, authenticated, service_role;

create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role' $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;

create publication supabase_realtime;
