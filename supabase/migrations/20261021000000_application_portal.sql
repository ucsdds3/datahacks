-- DataHacks application portal: the whole database side, in one file.
--
-- Builds everything the portal needs on a fresh Supabase project and brings an
-- existing one up to date. Safe to run more than once.
-- Run it in the Supabase dashboard: SQL Editor -> paste -> Run.
--
-- How people get their role:
--   Everyone signs in with Google and is a hacker by default. Mentors and judges
--   apply through /apply/mentor-judge. When an organizer sets that application's
--   status to 'accepted' (Table Editor -> applications), the database gives the
--   person that role. Nothing the browser sends can set a role or a status.


-- 1. profiles -----------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'hacker',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'hacker';
alter table public.profiles alter column role set default 'hacker';


-- 2. applications -------------------------------------------------------------
-- Hacker and mentor/judge applications share a table; applicant_type says which.
create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  applicant_type text not null,
  status         text not null default 'submitted',
  submitted_at   timestamptz not null default now(),
  email          text
);

alter table public.applications
  -- Both forms
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists linkedin_url text,
  -- Hacker form (src/pages/ApplicationForm.tsx)
  add column if not exists gender                 text,
  add column if not exists race_ethnicity         text,
  add column if not exists birthdate              date,
  add column if not exists country_of_residence   text,
  add column if not exists city_of_residence      text,
  add column if not exists level_of_study         text,
  add column if not exists school                 text,
  add column if not exists major                  text,
  add column if not exists graduation_year        text,
  add column if not exists hackathon_experience   text,
  add column if not exists attended_before        boolean,
  add column if not exists devpost_url            text,
  add column if not exists essay_proudest_project text,
  add column if not exists essay_unique_thing     text,
  add column if not exists essay_goal             text,
  add column if not exists funniest_joke          text,
  add column if not exists lifetime_goal          text,
  add column if not exists wants_travel_stipend   boolean,
  add column if not exists travel_stipend_reason  text,
  add column if not exists travel_region          text,
  add column if not exists heard_about            text[],
  add column if not exists agreed_to_terms        boolean,
  add column if not exists resume_path            text,
  -- Mentor/judge form (src/pages/MentorJudgeApplication.tsx)
  add column if not exists organization                   text,
  add column if not exists role_title                     text,
  add column if not exists resume_url                     text,
  add column if not exists ucsd_affiliation               text,
  add column if not exists judging_track                  text,
  add column if not exists bio                            text,
  add column if not exists acknowledged_in_person_judging boolean,
  add column if not exists acknowledged_onsite_mentoring  boolean,
  add column if not exists acknowledged_both_priority     boolean;

-- Applications used to be sent without signing in. Those rows belong to nobody
-- and can't be shown to anyone, so they go.
delete from public.applications where user_id is null;
alter table public.applications alter column user_id set not null;

-- One hacker application and one mentor/judge application per account. This
-- replaces the old one-per-email rule, which was a stand-in from before sign-in.
do $$
declare c record; idx record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.applications'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%email%'
  loop
    execute format('alter table public.applications drop constraint %I', c.conname);
  end loop;
  for idx in
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'applications'
      and indexdef ilike '%unique%' and indexdef ilike '%email%'
  loop
    execute format('drop index public.%I', idx.indexname);
  end loop;
end $$;

delete from public.applications a
using public.applications b
where a.user_id = b.user_id
  and (a.applicant_type = 'hacker') = (b.applicant_type = 'hacker')
  and (coalesce(a.submitted_at, 'epoch'), a.id::text) < (coalesce(b.submitted_at, 'epoch'), b.id::text);

create unique index if not exists applications_one_per_kind
  on public.applications (user_id, (applicant_type = 'hacker'));


-- 3. Allowed values -----------------------------------------------------------
-- Older check constraints on these columns are replaced, whatever they were called.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname from pg_constraint
    where contype = 'c'
      and conrelid in ('public.profiles'::regclass, 'public.applications'::regclass)
      and (pg_get_constraintdef(oid) ilike '%role%'
        or pg_get_constraintdef(oid) ilike '%applicant_type%'
        or pg_get_constraintdef(oid) ilike '%status%')
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check
  check (role in ('hacker', 'mentor', 'judge', 'hybrid')) not valid;
alter table public.applications add constraint applications_applicant_type_check
  check (applicant_type in ('hacker', 'mentor', 'judge', 'hybrid')) not valid;
alter table public.applications add constraint applications_status_check
  check (status in ('submitted', 'accepted', 'rejected', 'waitlisted')) not valid;


-- 4. Roles and statuses come from the database, never the browser ---------------

-- Someone's role: the type of their accepted mentor/judge application, else hacker.
create or replace function public.portal_role(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.applicant_type from public.applications a
      where a.user_id = uid and a.applicant_type <> 'hacker' and a.status = 'accepted'
      order by a.submitted_at desc
      limit 1),
    'hacker');
$$;
revoke all on function public.portal_role(uuid) from public, anon, authenticated;

-- Every profile write: email from the login, role from portal_role. Whatever the
-- request (or an organizer editing the row) put there is overwritten.
create or replace function public.profiles_set_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := (select u.email from auth.users u where u.id = new.id);
  new.role  := public.portal_role(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_set_role on public.profiles;
create trigger profiles_set_role
  before insert or update on public.profiles
  for each row execute function public.profiles_set_role();

-- Applications sent from the website: who, which email and what status come from
-- the login. Rows an organizer adds in the dashboard (no login) are left as typed.
create or replace function public.applications_set_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id      := auth.uid();
    new.email        := (select u.email from auth.users u where u.id = auth.uid());
    new.status       := 'submitted';
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists applications_set_status on public.applications;
create trigger applications_set_status
  before insert on public.applications
  for each row execute function public.applications_set_status();

-- Accepting, rejecting or deleting an application updates the person's role
-- straight away, rather than at their next sign-in.
create or replace function public.applications_sync_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  update public.profiles set role = role where id = uid;  -- profiles_set_role recomputes it
  return null;
end;
$$;

drop trigger if exists applications_sync_role on public.applications;
create trigger applications_sync_role
  after insert or update or delete on public.applications
  for each row execute function public.applications_sync_role();

-- Replaced by reading applications directly, now that staff sign in first.
drop function if exists public.get_my_staff_application();


-- 5. Who can read and write what ----------------------------------------------
-- Older policies are dropped first: policies add up, so a leftover permissive one
-- (say, letting anyone insert) would still let people through.
alter table public.profiles     enable row level security;
alter table public.applications enable row level security;

do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'applications')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "own profile: read"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile: create" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile: update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Applicants can submit and read their own. There is deliberately no update or
-- delete policy: status changes are made by organizers in the dashboard.
create policy "own application: read"   on public.applications for select to authenticated using (user_id = auth.uid());
create policy "own application: submit" on public.applications for insert to authenticated with check (user_id = auth.uid());


-- 6. Resumes ------------------------------------------------------------------
-- Private bucket. Files are stored as <user id>/<name>.pdf, so the first folder
-- is the owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%resumes%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "own resume: read"    on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own resume: upload"  on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own resume: replace" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);


-- 7. Put right anything already written ---------------------------------------
-- Touching each profile fires the trigger, which recomputes role and email.
update public.profiles set role = role;
alter table public.profiles alter column role set not null;


-- 8. Check --------------------------------------------------------------------
-- Should list exactly: 3 profile policies, 2 application policies, 3 resume policies.
select schemaname, tablename, policyname, cmd
from pg_policies
where (schemaname = 'public'  and tablename in ('profiles', 'applications'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
