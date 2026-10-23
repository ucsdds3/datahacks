-- Organizers can add and remove organizers from the console, and the mentor/judge
-- application no longer asks for a resume (hackers still upload one).
--
-- Organizer access is the 'organizer' row in event_roles (what is_event_staff
-- checks, for the organizer console and the check-in desk alike). Someone can be
-- added before they've ever signed in: the invite waits in organizer_invites and
-- turns into the role the first time they sign in with that Google account.
--
-- Additive on top of the live event model. Run in the Supabase SQL editor.
-- Safe to run twice.


-- 1. Invites for people who haven't signed in yet -----------------------------
create table if not exists public.organizer_invites (
  event_id   uuid not null references public.events (id) on delete cascade,
  email      text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, email)
);
-- No policies: only the functions below read or write it.
alter table public.organizer_invites enable row level security;

-- Signing in (the portal upserts the profile every time) turns invites into roles.
create or replace function public.grant_invited_organizer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_roles (event_id, user_id, role)
  select i.event_id, new.id, 'organizer'
  from public.organizer_invites i
  join auth.users u on u.id = new.id
  where i.email = lower(u.email) and u.email_confirmed_at is not null
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists grant_invited_organizer on public.profiles;
create trigger grant_invited_organizer
  after insert or update on public.profiles
  for each row execute function public.grant_invited_organizer();


-- 2. Console functions (organizers of the event only) -------------------------
create or replace function public.list_organizers(p_event_id uuid)
returns table (email text, status text, added_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  return query
  select lower(u.email)::text, 'active'::text, er.created_at
  from public.event_roles er join auth.users u on u.id = er.user_id
  where er.event_id = p_event_id and er.role = 'organizer'
  union all
  select i.email, 'invited'::text, i.created_at
  from public.organizer_invites i
  where i.event_id = p_event_id
    and not exists (
      select 1 from public.event_roles er join auth.users u on u.id = er.user_id
      where er.event_id = p_event_id and er.role = 'organizer' and lower(u.email) = i.email
    )
  order by 1;
end;
$$;

-- Returns 'added' (they had signed in before) or 'invited' (on their first sign-in).
create or replace function public.add_organizer(p_event_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user  uuid;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That doesn''t look like an email address.';
  end if;

  insert into public.organizer_invites (event_id, email, invited_by)
  values (p_event_id, v_email, auth.uid())
  on conflict (event_id, email) do nothing;

  select u.id into v_user from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = v_email and u.email_confirmed_at is not null
  limit 1;
  if v_user is null then
    return 'invited';
  end if;

  insert into public.event_roles (event_id, user_id, role)
  values (p_event_id, v_user, 'organizer')
  on conflict do nothing;
  return 'added';
end;
$$;

create or replace function public.remove_organizer(p_event_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'You can''t remove yourself. Ask another organizer.';
  end if;

  delete from public.organizer_invites where event_id = p_event_id and email = v_email;
  delete from public.event_roles er
  using auth.users u
  where er.user_id = u.id and er.event_id = p_event_id and er.role = 'organizer' and lower(u.email) = v_email;
end;
$$;

revoke all on function public.list_organizers(uuid) from public, anon;
revoke all on function public.add_organizer(uuid, text) from public, anon;
revoke all on function public.remove_organizer(uuid, text) from public, anon;
grant execute on function public.list_organizers(uuid) to authenticated;
grant execute on function public.add_organizer(uuid, text) to authenticated;
grant execute on function public.remove_organizer(uuid, text) to authenticated;


-- 3. Ansh and Tijil: organizers from their first sign-in ----------------------
insert into public.organizer_invites (event_id, email)
select e.id, x.email
from public.events e, (values ('abhatnagar@ucsd.edu'), ('tchhabra@ucsd.edu')) as x (email)
where e.code = 'DH26'
on conflict do nothing;


-- 4. No resume on mentor/judge applications --------------------------------------
-- Same rule as before, minus resume_url.
alter table public.applications drop constraint if exists applications_staff_fields_check;
alter table public.applications add constraint applications_staff_fields_check check (
  applicant_type = 'hacker'
  or (
    email is not null and organization is not null and role_title is not null
    and linkedin_url is not null and ucsd_affiliation is not null
    and (applicant_type = 'mentor' or (judging_track is not null and acknowledged_in_person_judging))
    and (applicant_type = 'judge' or (bio is not null and char_length(bio) between 100 and 500 and acknowledged_onsite_mentoring))
  )
);


-- 5. Check ----------------------------------------------------------------------
select 'invite' as kind, email as name from public.organizer_invites
union all
select 'function', proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('list_organizers', 'add_organizer', 'remove_organizer', 'grant_invited_organizer')
order by 1, 2;
