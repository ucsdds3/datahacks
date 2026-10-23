-- Organizer console: staged decisions, releasing them, the mentor roster, and
-- organizers reading resumes.
--
-- Builds on the live event model (events, event_roles, attendees and the
-- promote_accepted / upsert_attendee triggers). Only adds; nothing existing is
-- dropped. Run in the Supabase dashboard: SQL Editor -> paste -> Run. Safe to
-- run twice.


-- 1. New application columns ---------------------------------------------------
-- decision is what an organizer has picked but not yet released; status is what
-- the applicant sees. Releasing copies one to the other.
alter table public.applications
  add column if not exists phone                text,
  add column if not exists decision             text,
  add column if not exists decision_released_at timestamptz,
  add column if not exists decision_emailed_at  timestamptz;

alter table public.applications drop constraint if exists applications_decision_check;
alter table public.applications add constraint applications_decision_check
  check (decision is null or decision in ('accepted', 'waitlisted', 'rejected'));


-- 2. Only organizers stage decisions ----------------------------------------------
-- Organizers already update their event's rows through the "applications staff
-- update" policy. Applicants can update their own drafts, so without this they
-- could also write a decision onto one. From the website, anyone who isn't an
-- organizer of the row's event has the decision columns put back as they were.
-- Dashboard and server-side edits (no auth.uid()) are left alone.
create or replace function public.applications_guard_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_event_staff(old.event_id) then
    new.decision             := old.decision;
    new.decision_released_at := old.decision_released_at;
    new.decision_emailed_at  := old.decision_emailed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_guard_decision on public.applications;
create trigger applications_guard_decision
  before update on public.applications
  for each row execute function public.applications_guard_decision();

-- The same goes for new rows: an application is submitted without a decision.
create or replace function public.applications_no_decision_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_event_staff(new.event_id) then
    new.decision             := null;
    new.decision_released_at := null;
    new.decision_emailed_at  := null;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_no_decision_on_insert on public.applications;
create trigger applications_no_decision_on_insert
  before insert on public.applications
  for each row execute function public.applications_no_decision_on_insert();


-- 3. Releasing decisions ------------------------------------------------------------
-- One call applies every staged decision for the event. It's a plain UPDATE, so
-- the existing triggers grant roles and check-in codes for anyone accepted.
-- Returns who changed, so the console can email them.
create or replace function public.release_decisions(p_event_id uuid)
returns table (application_id uuid, email text, first_name text, applicant_type text, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;

  return query
  with released as (
    update public.applications a
    set status = a.decision, decision_released_at = now()
    where a.event_id = p_event_id
      and a.decision is not null
      and a.status is distinct from a.decision
    returning a.id, a.email, a.first_name, a.applicant_type, a.status, a.user_id
  )
  select r.id, coalesce(nullif(btrim(r.email), ''), p.email), r.first_name, r.applicant_type, r.status
  from released r
  left join public.profiles p on p.id = r.user_id;
end;
$$;

revoke all on function public.release_decisions(uuid) from public, anon;
grant execute on function public.release_decisions(uuid) to authenticated;


-- 4. Mentor roster for the hacker Mentors tab ------------------------------------
-- Hackers can't read other people's applications, so this hands out only what
-- the tab shows: accepted mentors' names, blurbs and whether they've checked in.
-- Open to anyone with a role at the event.
create or replace function public.mentor_roster(p_event_id uuid)
returns table (first_name text, last_name text, bio text, checked_in boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.event_roles er
    where er.event_id = p_event_id and er.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select a.first_name, a.last_name, a.bio,
         coalesce(at.checked_in_at is not null, false)
  from public.applications a
  left join public.attendees at on at.application_id = a.id
  where a.event_id = p_event_id
    and a.status = 'accepted'
    and a.applicant_type in ('mentor', 'hybrid')
  order by a.first_name, a.last_name;
end;
$$;

revoke all on function public.mentor_roster(uuid) from public, anon;
grant execute on function public.mentor_roster(uuid) to authenticated;


-- 5. Organizers can read resumes ------------------------------------------------------
drop policy if exists "organizers can read resumes" on storage.objects;
create policy "organizers can read resumes" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.event_roles er
      where er.user_id = auth.uid() and er.role = 'organizer'
    )
  );


-- 6. Check ----------------------------------------------------------------------------
select 'column' as kind, column_name as name
from information_schema.columns
where table_schema = 'public' and table_name = 'applications'
  and column_name in ('phone', 'decision', 'decision_released_at', 'decision_emailed_at')
union all
select 'function', proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('release_decisions', 'mentor_roster', 'applications_guard_decision', 'applications_no_decision_on_insert')
union all
select 'policy', policyname
from pg_policies
where schemaname = 'storage' and policyname = 'organizers can read resumes'
order by 1, 2;
