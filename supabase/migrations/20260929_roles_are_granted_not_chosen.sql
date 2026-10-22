-- Roles are granted by an organizer, not chosen by the visitor.
--
-- Before this, the sign-in callback read ?role= from the URL and wrote it to
-- profiles, so anyone could make themselves a judge. The application form also
-- sent its own status, so an applicant could insert status = 'accepted'.
--
-- After this, the browser's opinion on either is ignored: a trigger overwrites
-- role from an allowlist and status from a constant, whatever the client sends.
--
-- Run in the Supabase dashboard: SQL Editor -> paste -> Run. Safe to run twice.

-- 1. The allowlist -----------------------------------------------------------
-- Everyone is a hacker unless their email is in here. Organizers add rows in the
-- Table Editor. No policies on purpose: with RLS on and no policy, nothing signed
-- in through the website can read or write it.
create table if not exists public.role_grants (
  email      text primary key,
  role       text not null check (role in ('judge', 'mentor')),
  granted_at timestamptz not null default now()
);
alter table public.role_grants enable row level security;

-- 2. profiles ----------------------------------------------------------------
alter table public.profiles enable row level security;

create or replace function public.profiles_set_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  real_email text;
begin
  -- Email comes from the login itself, never from the request body.
  select u.email into real_email from auth.users u where u.id = new.id;
  new.email := real_email;
  new.role  := coalesce(
    (select g.role from public.role_grants g where lower(g.email) = lower(real_email)),
    'hacker'
  );
  return new;
end;
$$;

drop trigger if exists profiles_set_role on public.profiles;
create trigger profiles_set_role
  before insert or update on public.profiles
  for each row execute function public.profiles_set_role();

drop policy if exists "own profile: read"   on public.profiles;
drop policy if exists "own profile: create" on public.profiles;
drop policy if exists "own profile: update" on public.profiles;
create policy "own profile: read"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile: create" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile: update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 3. applications ------------------------------------------------------------
alter table public.applications enable row level security;

create or replace function public.applications_set_status()
returns trigger
language plpgsql
as $$
begin
  new.user_id      := auth.uid();
  new.status       := 'submitted';
  new.submitted_at := now();
  return new;
end;
$$;

drop trigger if exists applications_set_status on public.applications;
create trigger applications_set_status
  before insert on public.applications
  for each row execute function public.applications_set_status();

-- Applicants can submit and read their own. There is deliberately no update or
-- delete policy: status changes are made by organizers in the dashboard.
drop policy if exists "own application: read"   on public.applications;
drop policy if exists "own application: submit" on public.applications;
create policy "own application: read"   on public.applications for select to authenticated using (user_id = auth.uid());
create policy "own application: submit" on public.applications for insert to authenticated with check (user_id = auth.uid());

-- 4. resumes -----------------------------------------------------------------
-- Files are stored as <user id>/<name>.pdf, so the first folder is the owner.
update storage.buckets set public = false where id = 'resumes';

drop policy if exists "own resume: read"    on storage.objects;
drop policy if exists "own resume: upload"  on storage.objects;
drop policy if exists "own resume: replace" on storage.objects;
create policy "own resume: read"    on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own resume: upload"  on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own resume: replace" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Put right anything already written ---------------------------------------
-- Touching each row fires the trigger, which resets role from the allowlist.
update public.profiles set id = id;

-- 6. Check for leftovers -----------------------------------------------------
-- Policies are additive: an older permissive one still lets people through.
-- Anything listed here that is not one of the nine above should be dropped.
select schemaname, tablename, policyname, cmd
from pg_policies
where (schemaname = 'public'  and tablename in ('profiles', 'applications', 'role_grants'))
   or (schemaname = 'storage' and tablename = 'objects')
order by tablename, policyname;
