-- Application portal: mentors and judges sign in before they apply.
--
-- The live project already has the event model this builds on (events,
-- event_roles, attendees, checkins; promote_accepted, link_staff_applications,
-- upsert_attendee). That schema isn't in this repo yet; see
-- docs/application-portal-todo.md. This file only changes what the portal needs.
--
-- Run in the Supabase dashboard: SQL Editor -> paste -> Run. Safe to run twice.


-- 1. Mentor/judge applications come from signed-in accounts --------------------
-- They used to be sent anonymously and matched to an account by email later.
-- Now the website requires sign-in for every application, so the anonymous
-- route closes and the "own application" rule covers every applicant type.
-- Status can still only be draft or submitted: organizers decide the rest.
drop policy if exists "anyone can apply as mentor or judge" on public.applications;

drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own on public.applications
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and applicant_type in ('hacker', 'mentor', 'judge', 'hybrid')
    and status in ('draft', 'submitted')
  );


-- 2. profiles: role and email aren't the browser's to set -------------------------
-- Roles live in event_roles (granted when an application is accepted), so the
-- website no longer sends one. New profiles start as hacker.
alter table public.profiles alter column role set default 'hacker';

-- Email always comes from the login. upsert_attendee falls back to it for
-- check-in emails, so a user editing their own row mustn't be able to change it.
create or replace function public.profiles_email_from_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := coalesce((select u.email from auth.users u where u.id = new.id), new.email);
  -- From the website (a signed-in request), role is never taken from the request.
  -- Organizers editing in the dashboard have no auth.uid() and are left alone.
  if auth.uid() is not null then
    new.role := case when tg_op = 'UPDATE' then old.role else 'hacker' end;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_email_from_login on public.profiles;
create trigger profiles_email_from_login
  before insert or update on public.profiles
  for each row execute function public.profiles_email_from_login();


-- 3. Check --------------------------------------------------------------------
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public' and tablename = 'applications' and cmd = 'INSERT';
