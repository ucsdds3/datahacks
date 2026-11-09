-- Launch audit fixes for decisions, applicant rows and organizers
-- (~/Desktop/launch-audit 3-organizer.md H3, H4, M1, M6 and 4-security.md 3, 6, 7, 8).
-- Additive: new columns, functions and triggers; nothing is dropped except the
-- one-argument release_decisions, which is recreated with optional arguments so
-- existing callers (release_decisions(p_event_id)) keep working.
--
-- 1. Staff checks never count tokens issued to OAuth clients (MCP, AI apps).
--    Supabase's OAuth 2.1 server puts the client in the `client_id` claim of
--    the access token (docs: auth/oauth-server/token-security); a normal
--    sign-in has none. An organizer who connects an AI client gets an
--    applicant's powers through it, never the console's.
-- 2. Applicants can't read a decision before it's released. `decision` (and the
--    new audit columns) lose SELECT for anon and authenticated: the applicant's
--    own row reads `status`, which only changes when decisions are released, so
--    the portal and MCP keep working unchanged. Organizers read decisions
--    through staged_decisions() and change them through stage_decisions().
--    NOTE for future migrations: SELECT on applications is granted column by
--    column now, so a new column needs `grant select (col) on public.applications
--    to anon, authenticated;` (the DB tests fail until it has one).
-- 3. Optimistic concurrency and an audit trail: decided_by, decided_at and
--    decision_version are stamped by a trigger whenever the decision changes.
--    stage_decisions() takes the versions the organizer saw and refuses rows
--    someone else changed since.
-- 4. Drafts (never submitted) can't be decided or released.
-- 5. release_decisions(p_event_id, p_ids, p_versions) releases exactly the
--    rows the organizer was shown, and resets decision_emailed_at so the new
--    decision's email counts as unsent.
-- 6. An applicant's email is always their sign-in email, and created_at /
--    submitted_at are set by the server, not the browser.
-- 7. remove_organizer never leaves an event without an organizer, even when two
--    organizers remove each other at the same moment.

-- 1. Staff checks ------------------------------------------------------------

create or replace function public.is_event_staff(eid uuid) returns boolean
  language sql stable security definer
  set search_path to 'public'
as $$
  select (auth.jwt() ->> 'client_id') is null
     and exists (
       select 1 from public.event_roles er
       where er.event_id = eid
         and er.user_id = auth.uid()
         and er.role = 'organizer'
     );
$$;

create or replace function public.mentor_roster(p_event_id uuid)
  returns table(first_name text, last_name text, bio text, checked_in boolean)
  language plpgsql stable security definer
  set search_path to 'public'
as $$
begin
  if (auth.jwt() ->> 'client_id') is not null or not exists (
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


-- 2-3. Decision audit columns and column privileges ---------------------------

alter table public.applications
  add column if not exists decided_by uuid references auth.users(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists decision_version integer not null default 0;

-- Every column except the review ones, for anon and authenticated. Row-level
-- security still decides which rows (applicants: their own; organizers: their event's).
revoke select on table public.applications from anon, authenticated;
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_cols
    from pg_attribute
   where attrelid = 'public.applications'::regclass and attnum > 0 and not attisdropped
     and attname not in ('decision', 'decided_by', 'decided_at', 'decision_version');
  execute format('grant select (%s) on table public.applications to anon, authenticated', v_cols);
end $$;

-- Stamps who changed the decision and when, and bumps the version, on every
-- change by anyone (console, RPCs, SQL editor). Nobody can write these three
-- columns directly. Runs after applications_guard_decision (triggers fire in
-- name order), so an applicant's attempt to decide is already undone here.
create or replace function public.applications_stamp_decision() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.decision_version := 0;
    new.decided_by := case when new.decision is null then null else auth.uid() end;
    new.decided_at := case when new.decision is null then null else now() end;
    return new;
  end if;

  if new.decision is distinct from old.decision then
    if new.decision is not null and new.status = 'draft' then
      raise exception 'This application hasn''t been submitted yet, so it can''t get a decision.'
        using errcode = 'check_violation';
    end if;
    new.decision_version := old.decision_version + 1;
    new.decided_by := auth.uid();
    new.decided_at := now();
  else
    new.decision_version := old.decision_version;
    new.decided_by := old.decided_by;
    new.decided_at := old.decided_at;
  end if;
  return new;
end $$;

revoke all on function public.applications_stamp_decision() from public, anon, authenticated;
grant all on function public.applications_stamp_decision() to service_role;

drop trigger if exists applications_stamp_decision on public.applications;
create trigger applications_stamp_decision before insert or update on public.applications
  for each row execute function public.applications_stamp_decision();


-- Organizers' read of the review columns. Only rows that have (or had) a
-- decision; anything missing is undecided at version 0. One jsonb value, so
-- the API's 1,000-row cap doesn't apply.
create or replace function public.staged_decisions(p_event_id uuid) returns jsonb
  language plpgsql stable security definer
  set search_path to 'public'
as $$
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'decision', a.decision,
             'version', a.decision_version,
             'decided_at', a.decided_at,
             'decided_by', lower(u.email)) order by a.id)
      from public.applications a
      left join auth.users u on u.id = a.decided_by
     where a.event_id = p_event_id
       and (a.decision is not null or a.decision_version > 0)
  ), '[]'::jsonb);
end $$;

revoke all on function public.staged_decisions(uuid) from public, anon;
grant execute on function public.staged_decisions(uuid) to authenticated, service_role;


-- Stages (or clears, with null) a decision for each id. p_versions, when
-- given, are the decision_version the organizer saw for each id (same order):
-- a row whose version moved on since was changed by someone else and is left
-- alone. Returns what happened to each id:
--   { updated: [{id, version}], conflicts: [{id, decision, decided_by, decided_at, version}],
--     drafts: [id], missing: [id] }
create or replace function public.stage_decisions(
  p_event_id uuid, p_ids uuid[], p_decision text, p_versions integer[] default null
) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_updated   jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_drafts    jsonb := '[]'::jsonb;
  v_missing   jsonb := '[]'::jsonb;
  x           record;
  a           public.applications%rowtype;
  v_by        text;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if p_decision is not null and p_decision not in ('accepted', 'waitlisted', 'rejected') then
    raise exception 'Unknown decision "%".', p_decision using errcode = 'invalid_parameter_value';
  end if;
  if p_versions is not null and cardinality(p_versions) <> cardinality(p_ids) then
    raise exception 'Send one version per application.' using errcode = 'invalid_parameter_value';
  end if;
  if cardinality(p_ids) > 1000 then
    raise exception 'At most 1,000 applications at a time.' using errcode = 'invalid_parameter_value';
  end if;

  -- In id order, so two organizers' bulk changes lock rows in the same order.
  for x in
    select distinct on (u.id) u.id, u.v
      from unnest(p_ids, coalesce(p_versions, array[]::integer[])) as u(id, v)
     where u.id is not null
     order by u.id
  loop
    select * into a from public.applications where id = x.id and event_id = p_event_id for update;
    if not found then
      v_missing := v_missing || to_jsonb(x.id);
    elsif a.status = 'draft' and p_decision is not null then
      v_drafts := v_drafts || to_jsonb(x.id);
    elsif x.v is not null and a.decision_version <> x.v then
      select lower(email) into v_by from auth.users where id = a.decided_by;
      v_conflicts := v_conflicts || jsonb_build_object(
        'id', a.id, 'decision', a.decision, 'decided_by', v_by,
        'decided_at', a.decided_at, 'version', a.decision_version);
    elsif a.decision is not distinct from p_decision then
      v_updated := v_updated || jsonb_build_object('id', a.id, 'version', a.decision_version);
    else
      update public.applications set decision = p_decision where id = a.id
        returning * into a;
      v_updated := v_updated || jsonb_build_object('id', a.id, 'version', a.decision_version);
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'conflicts', v_conflicts, 'drafts', v_drafts, 'missing', v_missing);
end $$;

revoke all on function public.stage_decisions(uuid, uuid[], text, integer[]) from public, anon;
grant execute on function public.stage_decisions(uuid, uuid[], text, integer[]) to authenticated, service_role;


-- 4-5. Release ---------------------------------------------------------------

drop function if exists public.release_decisions(uuid);
create or replace function public.release_decisions(
  p_event_id uuid, p_ids uuid[] default null, p_versions integer[] default null
) returns table(application_id uuid, email text, first_name text, applicant_type text, status text)
  language plpgsql security definer
  set search_path to 'public'
as $$
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if p_ids is not null and p_versions is not null and cardinality(p_versions) <> cardinality(p_ids) then
    raise exception 'Send one version per application.' using errcode = 'invalid_parameter_value';
  end if;

  return query
  with wanted as (
    select u.id, u.v
      from unnest(coalesce(p_ids, array[]::uuid[]), coalesce(p_versions, array[]::integer[])) as u(id, v)
  ),
  released as (
    update public.applications a
       set status = a.decision,
           decision_released_at = now(),
           decision_emailed_at = null
     where a.event_id = p_event_id
       and a.decision is not null
       and a.status is distinct from a.decision
       and a.status <> 'draft'
       and (p_ids is null or exists (
             select 1 from wanted w
              where w.id = a.id and (w.v is null or w.v = a.decision_version)))
    returning a.id, a.email, a.first_name, a.applicant_type, a.status, a.user_id
  )
  select r.id, coalesce(nullif(btrim(r.email), ''), p.email), r.first_name, r.applicant_type, r.status
    from released r
    left join public.profiles p on p.id = r.user_id;
end;
$$;

revoke all on function public.release_decisions(uuid, uuid[], integer[]) from public, anon;
grant execute on function public.release_decisions(uuid, uuid[], integer[]) to authenticated, service_role;


-- 6. Fields the applicant doesn't control ------------------------------------

-- For a signed-in applicant (not an organizer of the event):
--   email         always their sign-in email, so nobody can file under, or
--                 squat on, someone else's address
--   created_at    now() on insert, never changed after
--   submitted_at  now() when the row becomes submitted, otherwise unchanged
-- Organizers, the SQL editor and the service role are left alone. Inside
-- other functions (linking an account, waitlist opt-in) nothing here changes,
-- since they don't touch these columns.
create or replace function public.applications_applicant_owned() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_email text;
begin
  if auth.uid() is null or public.is_event_staff(new.event_id) then
    return new;
  end if;

  if tg_op = 'INSERT' or new.email is distinct from old.email then
    select lower(btrim(u.email)) into v_email from auth.users u where u.id = auth.uid();
    if coalesce(v_email, '') = '' then
      raise exception 'Your account has no email address. Sign in with Google and try again.'
        using errcode = 'check_violation';
    end if;
    new.email := v_email;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.submitted_at := case when new.status = 'submitted' then now() end;
  else
    new.created_at := old.created_at;
    new.submitted_at := case
      when new.status = 'submitted' and old.status is distinct from 'submitted' then now()
      else old.submitted_at
    end;
  end if;
  return new;
end $$;

revoke all on function public.applications_applicant_owned() from public, anon, authenticated;
grant all on function public.applications_applicant_owned() to service_role;

drop trigger if exists applications_applicant_owned on public.applications;
create trigger applications_applicant_owned before insert or update on public.applications
  for each row execute function public.applications_applicant_owned();


-- 7. Never zero organizers ---------------------------------------------------

create or replace function public.remove_organizer(p_event_id uuid, p_email text) returns void
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_left  integer;
begin
  -- One removal per event at a time. Checked after the lock, so an organizer
  -- removed a moment ago by someone else can't remove anyone.
  perform pg_advisory_xact_lock(hashtext('remove_organizer:' || p_event_id::text));

  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'You can''t remove yourself. Ask another organizer.';
  end if;

  select count(*) into v_left
    from public.event_roles er join auth.users u on u.id = er.user_id
   where er.event_id = p_event_id and er.role = 'organizer' and lower(u.email) <> v_email;
  if v_left < 1 then
    raise exception 'An event needs at least one organizer.' using errcode = 'check_violation';
  end if;

  delete from public.organizer_invites where event_id = p_event_id and email = v_email;
  delete from public.event_roles er
  using auth.users u
  where er.user_id = u.id and er.event_id = p_event_id and er.role = 'organizer' and lower(u.email) = v_email;
end;
$$;

-- Last line of defence for any other path (a future function, a bad script
-- through the API): a delete that leaves an event that had organizers with
-- none fails. Row-level AFTER triggers run once the statement is done, so
-- deleting every organizer in one statement is caught too. The SQL editor and
-- the service role (no signed-in user) can still clean up, e.g. deleting a
-- whole test event.
create or replace function public.event_roles_keep_an_organizer() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
begin
  if auth.uid() is not null
     and old.role = 'organizer'
     and exists (select 1 from public.events e where e.id = old.event_id)
     and not exists (select 1 from public.event_roles er where er.event_id = old.event_id and er.role = 'organizer') then
    raise exception 'An event needs at least one organizer.' using errcode = 'check_violation';
  end if;
  return null;
end $$;

revoke all on function public.event_roles_keep_an_organizer() from public, anon, authenticated;
grant all on function public.event_roles_keep_an_organizer() to service_role;

drop trigger if exists event_roles_keep_an_organizer on public.event_roles;
create trigger event_roles_keep_an_organizer after delete on public.event_roles
  for each row execute function public.event_roles_keep_an_organizer();
