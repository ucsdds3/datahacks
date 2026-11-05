-- Check-in, batch 2: a check-in log, meal/swag scans, offline-safe check-ins,
-- and what the desk needs for an ID check.
--
-- 1. public.checkin_events: append-only log of every check-in, undo and
--    meal/swag scan. Written only by the RPCs below (security definer);
--    organizers of the event can read it; nobody can update or delete a row
--    (no grants, no policies, and a trigger that refuses even the table owner;
--    rows go only when their event is deleted). Existing check-ins are copied
--    in once, as source 'backfill', so the console's feed starts complete.
--
-- 2. check_in_by_code gains three optional parameters (old calls still work):
--      p_checked_in_at  when the desk scanned them (offline scans keep their
--                       time), clamped to [now() - 12 h, now() + 2 min]
--      p_client_id      idempotency key: the same id again returns the first
--                       answer ('ok', replay: true), not "already checked in"
--      p_source         'online' (default) or 'offline' (sent from the queue)
--    undo_check_in gains p_expected_checked_in_at: if the person was checked in
--    again since the desk looked, it refuses (hint 'checkin_changed') instead
--    of undoing someone else's check-in. Both keep every existing answer, the
--    waiver field and the no-show refusal (hint 'no_show', from the trigger).
--    The old two-argument functions are dropped and recreated with defaults,
--    so { p_event_id, p_code } calls from the live app resolve to the new ones.
--
-- 3. public.scan_types: per event, what the desk can scan for besides check-in
--    ("Lunch · Sat", kind meal | swag | other, active, sort, optional window).
--    Organizers add, rename, reorder and switch them off (no delete: scans
--    point at them). record_scan(event, code, scan_type, scanned_at,
--    client_id, source) records one scan per person per scan type:
--      ok | not_checked_in (recorded, flagged) | already (first time + who)
--      | not_on_roster. Idempotent by client id, like check-ins. Any scan type
--    of the event is accepted, active or not, so a scan queued offline never
--    fails because the type was switched off meanwhile; "active" is what the
--    desk offers. The window (opens_at/closes_at) is shown, not enforced.
--
-- 4. ID check: attendees.affiliation (school for hackers, organization for
--    mentors and judges) and attendees.is_18_plus_on_event_day (hackers only:
--    birthdate + 18 years on or before the event's start date in Pacific time;
--    null = unknown). The birthdate itself never reaches the roster or the
--    scan answer. Kept by upsert_attendee, and recomputed when an event's
--    start moves. Hackers' applications already require 18+ at the time they
--    apply (application_checks), so "under 18" is a safety net.
--
-- Additive except the two dropped-and-recreated functions (same names, same
-- answers for old calls). Safe to re-run.


-- 4. ID check columns (first: the RPCs below return them) --------------------

alter table public.attendees
  add column if not exists affiliation             text,
  add column if not exists is_18_plus_on_event_day boolean;

-- 18 on or before the event's first day (Pacific). null when either is unknown.
-- Born 29 February: + 18 years is 28 February in Postgres.
create or replace function public.is_18_plus_on(p_birthdate date, p_event_start timestamptz) returns boolean
  language sql immutable
  set search_path to 'public'
as $$
  select case when p_birthdate is null or p_event_start is null then null
              else (p_birthdate + interval '18 years')::date <= (p_event_start at time zone 'America/Los_Angeles')::date end
$$;

-- School for hackers; organization (else school) for mentors and judges.
create or replace function public.attendee_affiliation(p_type text, p_school text, p_organization text) returns text
  language sql immutable
  set search_path to 'public'
as $$
  select case when p_type = 'hacker' then nullif(btrim(p_school), '')
              else coalesce(nullif(btrim(p_organization), ''), nullif(btrim(p_school), '')) end
$$;

revoke all on function public.is_18_plus_on(date, timestamptz) from public, anon, authenticated;
revoke all on function public.attendee_affiliation(text, text, text) from public, anon, authenticated;
grant execute on function public.is_18_plus_on(date, timestamptz) to service_role;
grant execute on function public.attendee_affiliation(text, text, text) to service_role;

-- As in 20261104200000_waivers_on_file.sql, plus affiliation and the 18+ flag.
create or replace function public.upsert_attendee(p_application_id uuid) returns void
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  a        public.applications%rowtype;
  p        public.profiles%rowtype;
  v_roles  text[];
  v_email  text;
  v_name   text;
  v_code   text;
  v_waiver timestamptz;
  v_start  timestamptz;
  v_aff    text;
  v_adult  boolean;
begin
  select * into a from public.applications where id = p_application_id;
  if not found then
    return;
  end if;

  -- No longer accepted (or no event): remove the roster row unless the person
  -- already checked in.
  if a.status is distinct from 'accepted' or a.event_id is null then
    delete from public.attendees
     where application_id = a.id and checked_in_at is null;
    return;
  end if;

  -- Application moved to a different event: drop the old row (new code needed).
  delete from public.attendees
   where application_id = a.id and event_id <> a.event_id and checked_in_at is null;

  if a.user_id is not null then
    select * into p from public.profiles where id = a.user_id;
    select w.signed_at into v_waiver from public.waivers w
     where w.event_id = a.event_id and w.user_id = a.user_id;
  end if;

  v_roles := case a.applicant_type
    when 'hacker' then array['hacker']
    when 'mentor' then array['mentor']
    when 'judge'  then array['judge']
    when 'hybrid' then array['mentor','judge']
    else array['hacker']
  end;

  v_email := nullif(btrim(coalesce(a.email, p.email)), '');
  v_name  := coalesce(
    nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''),
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
    v_email,
    'Unknown'
  );

  select e.starts_at into v_start from public.events e where e.id = a.event_id;
  v_aff   := public.attendee_affiliation(a.applicant_type, a.school, a.organization);
  v_adult := case when a.applicant_type = 'hacker' then public.is_18_plus_on(a.birthdate, v_start) end;

  select code into v_code from public.attendees where application_id = a.id;
  if v_code is null then
    perform pg_advisory_xact_lock(hashtext(a.event_id::text));
    v_code := public.next_attendee_code(a.event_id, v_roles);
  end if;

  insert into public.attendees (event_id, application_id, user_id, code, name, email, roles, waiver_signed_at,
                                affiliation, is_18_plus_on_event_day)
  values (a.event_id, a.id, a.user_id, v_code, v_name, v_email, v_roles, v_waiver, v_aff, v_adult)
  on conflict (application_id) do update
    set user_id                 = excluded.user_id,
        name                    = excluded.name,
        email                   = excluded.email,
        roles                   = excluded.roles,
        waiver_signed_at        = excluded.waiver_signed_at,
        affiliation             = excluded.affiliation,
        is_18_plus_on_event_day = excluded.is_18_plus_on_event_day,
        emailed_at = case when public.attendees.email is distinct from excluded.email
                          then null else public.attendees.emailed_at end;
end $$;

-- An event's start moved: everyone's "18+ on the day" moves with it.
create or replace function public.trg_event_start_ages() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
begin
  update public.attendees t
     set is_18_plus_on_event_day = public.is_18_plus_on(a.birthdate, new.starts_at)
    from public.applications a
   where a.id = t.application_id and t.event_id = new.id and a.applicant_type = 'hacker'
     and t.is_18_plus_on_event_day is distinct from public.is_18_plus_on(a.birthdate, new.starts_at);
  return null;
end $$;

revoke all on function public.trg_event_start_ages() from public, anon, authenticated;
grant all on function public.trg_event_start_ages() to service_role;

drop trigger if exists event_start_ages on public.events;
create trigger event_start_ages after update of starts_at on public.events
  for each row when (old.starts_at is distinct from new.starts_at)
  execute function public.trg_event_start_ages();

-- Roster rows made before this migration.
update public.attendees t
   set affiliation             = public.attendee_affiliation(a.applicant_type, a.school, a.organization),
       is_18_plus_on_event_day = case when a.applicant_type = 'hacker' then public.is_18_plus_on(a.birthdate, e.starts_at) end
  from public.applications a, public.events e
 where a.id = t.application_id and e.id = t.event_id
   and (t.affiliation is distinct from public.attendee_affiliation(a.applicant_type, a.school, a.organization)
        or t.is_18_plus_on_event_day is distinct from
           case when a.applicant_type = 'hacker' then public.is_18_plus_on(a.birthdate, e.starts_at) end);


-- 3. Scan types --------------------------------------------------------------

create table if not exists public.scan_types (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  label      text not null,
  kind       text not null default 'meal',
  active     boolean not null default true,
  sort       integer not null default 0,
  opens_at   timestamptz,
  closes_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint scan_types_label_check check (char_length(btrim(label)) between 1 and 60 and label !~ '[\x01-\x1f\x7f]'),
  constraint scan_types_kind_check check (kind in ('meal', 'swag', 'other')),
  constraint scan_types_sort_check check (sort between -100000 and 100000),
  constraint scan_types_window_check check (opens_at is null or closes_at is null or closes_at > opens_at),
  -- For checkin_events' (scan_type_id, event_id) foreign key: a scan's type is at the scan's event.
  constraint scan_types_id_event_key unique (id, event_id)
);

create unique index if not exists scan_types_event_label_key on public.scan_types (event_id, lower(btrim(label)));

comment on table public.scan_types is
  'What the check-in desk can scan for besides check-in (meals, swag), per event. Organizers of the event only.';

alter table public.scan_types enable row level security;

revoke all on table public.scan_types from public, anon, authenticated;
grant select, insert, update on table public.scan_types to authenticated;
grant all on table public.scan_types to service_role;

drop policy if exists "scan_types staff read" on public.scan_types;
create policy "scan_types staff read" on public.scan_types for select to authenticated
  using (public.is_event_staff(event_id));
drop policy if exists "scan_types organizer insert" on public.scan_types;
create policy "scan_types organizer insert" on public.scan_types for insert to authenticated
  with check (public.is_event_staff(event_id));
drop policy if exists "scan_types organizer update" on public.scan_types;
create policy "scan_types organizer update" on public.scan_types for update to authenticated
  using (public.is_event_staff(event_id)) with check (public.is_event_staff(event_id));

create or replace function public.scan_types_stamp() returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  new.label := btrim(new.label);
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

revoke all on function public.scan_types_stamp() from public, anon, authenticated;
grant all on function public.scan_types_stamp() to service_role;

drop trigger if exists scan_types_stamp on public.scan_types;
create trigger scan_types_stamp before insert or update on public.scan_types
  for each row execute function public.scan_types_stamp();


-- 1. The check-in log --------------------------------------------------------

create table if not exists public.checkin_events (
  id             bigint generated always as identity primary key,
  event_id       uuid not null references public.events(id) on delete cascade,
  -- No foreign key: a roster row can be deleted (a decision reversed) and its
  -- history stays. code is kept for that reason too.
  attendee_id    uuid not null,
  code           text not null,
  kind           text not null,
  scan_type_id   uuid,
  by_user        uuid,
  client_id      text,
  scanned_at     timestamptz not null,
  recorded_at    timestamptz not null default now(),
  source         text not null default 'online',
  not_checked_in boolean not null default false,
  constraint checkin_events_kind_check check (kind in ('check_in', 'undo', 'scan')),
  constraint checkin_events_scan_type_check check ((kind = 'scan') = (scan_type_id is not null)),
  constraint checkin_events_flag_check check (kind = 'scan' or not not_checked_in),
  constraint checkin_events_source_check check (source in ('online', 'offline', 'backfill')),
  constraint checkin_events_client_id_check check (client_id is null or client_id ~ '^[A-Za-z0-9-]{8,64}$'),
  constraint checkin_events_scan_type_fkey foreign key (scan_type_id, event_id) references public.scan_types (id, event_id)
);

create unique index if not exists checkin_events_client_key on public.checkin_events (event_id, client_id)
  where client_id is not null;
-- One scan per person per scan type.
create unique index if not exists checkin_events_one_scan_key on public.checkin_events (scan_type_id, attendee_id)
  where kind = 'scan';
create index if not exists checkin_events_event_time_idx on public.checkin_events (event_id, scanned_at desc);
create index if not exists checkin_events_attendee_idx on public.checkin_events (attendee_id);

comment on table public.checkin_events is
  'Append-only log of check-ins, undos and meal/swag scans. Written only by check_in_by_code, undo_check_in and record_scan; organizers of the event read.';

alter table public.checkin_events enable row level security;

revoke all on table public.checkin_events from public, anon, authenticated, service_role;
grant select on table public.checkin_events to authenticated;
grant select, insert on table public.checkin_events to service_role;

drop policy if exists "checkin_events staff read" on public.checkin_events;
create policy "checkin_events staff read" on public.checkin_events for select to authenticated
  using (public.is_event_staff(event_id));

-- Nobody changes the log, the table owner included. Rows go only with their
-- event (the cascade runs after the event row is gone).
create or replace function public.checkin_events_append_only() returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.events e where e.id = old.event_id) then
    return old;
  end if;
  raise exception 'The check-in log can''t be changed.' using hint = 'append_only';
end $$;

revoke all on function public.checkin_events_append_only() from public, anon, authenticated;
grant all on function public.checkin_events_append_only() to service_role;

drop trigger if exists checkin_events_append_only on public.checkin_events;
create trigger checkin_events_append_only before update or delete on public.checkin_events
  for each row execute function public.checkin_events_append_only();
drop trigger if exists checkin_events_no_truncate on public.checkin_events;
create trigger checkin_events_no_truncate before truncate on public.checkin_events
  for each statement execute function public.checkin_events_append_only();

-- The console follows the log over Realtime (meal scans don't touch attendees).
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checkin_events') then
    alter publication supabase_realtime add table public.checkin_events;
  end if;
end $$;

-- Everyone already checked in, once, so the log starts complete.
insert into public.checkin_events (event_id, attendee_id, code, kind, by_user, scanned_at, source)
select t.event_id, t.id, t.code, 'check_in', t.checked_in_by, t.checked_in_at, 'backfill'
  from public.attendees t
 where t.checked_in_at is not null
   and not exists (select 1 from public.checkin_events e where e.attendee_id = t.id);


-- 2. Helpers (not callable through the API) ----------------------------------

-- A desk's time, kept within [now() - 12 h, now() + 2 min]; null is now.
create or replace function public.clamp_desk_time(p_at timestamptz) returns timestamptz
  language sql stable
  set search_path to 'public'
as $$
  select case when p_at is null then now()
              else greatest(now() - interval '12 hours', least(now() + interval '2 minutes', p_at)) end
$$;

-- 'online' (default) or 'offline'; anything else is refused.
create or replace function public.desk_source(p_source text) returns text
  language plpgsql immutable
  set search_path to 'public'
as $$
begin
  if p_source is null then
    return 'online';
  end if;
  if p_source not in ('online', 'offline') then
    raise exception 'Source must be online or offline.' using hint = 'source';
  end if;
  return p_source;
end $$;

create or replace function public.check_client_id(p_client_id text) returns void
  language plpgsql immutable
  set search_path to 'public'
as $$
begin
  if p_client_id is not null and p_client_id !~ '^[A-Za-z0-9-]{8,64}$' then
    raise exception 'Bad client id.' using hint = 'client_id';
  end if;
end $$;

-- What a desk calls an organizer: first name, else the start of their email.
create or replace function public.desk_name(p_user uuid) returns text
  language sql stable
  set search_path to 'public'
as $$
  select coalesce(nullif(btrim(p.first_name), ''), nullif(split_part(p.email, '@', 1), ''))
    from public.profiles p where p.id = p_user
$$;

-- The scan card's fields for a roster row.
create or replace function public.desk_card(r public.attendees, p_status text) returns jsonb
  language sql stable
  set search_path to 'public'
as $$
  select jsonb_build_object(
    'status', p_status, 'code', r.code, 'name', r.name, 'roles', to_jsonb(r.roles), 'team', r.team,
    'checked_in_at', r.checked_in_at, 'waiver_signed_at', r.waiver_signed_at,
    'affiliation', r.affiliation, 'is_18_plus_on_event_day', r.is_18_plus_on_event_day)
$$;

-- The log row an earlier call with this client id wrote, if any. A client id
-- reused for a different person or action is refused.
create or replace function public.checkin_event_for_client(p_event_id uuid, p_client_id text, p_kind text, p_code text, p_scan_type_id uuid)
  returns public.checkin_events
  language plpgsql stable
  set search_path to 'public'
as $$
declare
  l public.checkin_events%rowtype;
begin
  if p_client_id is null then
    return null;
  end if;
  select * into l from public.checkin_events where event_id = p_event_id and client_id = p_client_id;
  if found and (l.kind <> p_kind or l.code <> p_code or l.scan_type_id is distinct from p_scan_type_id) then
    raise exception 'That client id was already used for something else.' using hint = 'client_id';
  end if;
  return l;
end $$;

revoke all on function public.clamp_desk_time(timestamptz) from public, anon, authenticated;
revoke all on function public.desk_source(text) from public, anon, authenticated;
revoke all on function public.check_client_id(text) from public, anon, authenticated;
revoke all on function public.desk_name(uuid) from public, anon, authenticated;
revoke all on function public.desk_card(public.attendees, text) from public, anon, authenticated;
revoke all on function public.checkin_event_for_client(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.clamp_desk_time(timestamptz) to service_role;
grant execute on function public.desk_source(text) to service_role;
grant execute on function public.check_client_id(text) to service_role;
grant execute on function public.desk_name(uuid) to service_role;
grant execute on function public.desk_card(public.attendees, text) to service_role;
grant execute on function public.checkin_event_for_client(uuid, text, text, text, uuid) to service_role;


-- 2. check_in_by_code / undo_check_in ---------------------------------------

drop function if exists public.check_in_by_code(uuid, text);

create or replace function public.check_in_by_code(
  p_event_id      uuid,
  p_code          text,
  p_checked_in_at timestamptz default null,
  p_client_id     text default null,
  p_source        text default 'online'
) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_at   timestamptz;
  v_src  text;
  r      public.attendees%rowtype;
  l      public.checkin_events%rowtype;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  perform public.check_client_id(p_client_id);
  v_src := public.desk_source(p_source);
  v_at  := public.clamp_desk_time(p_checked_in_at);

  -- The same request again (its answer was lost): the first answer.
  l := public.checkin_event_for_client(p_event_id, p_client_id, 'check_in', v_code, null);
  if l.id is not null then
    select * into r from public.attendees where id = l.attendee_id;
    return public.desk_card(r, 'ok')
           || jsonb_build_object('code', l.code, 'checked_in_at', l.scanned_at, 'replay', true);
  end if;

  update public.attendees
     set checked_in_at = v_at,
         checked_in_by = auth.uid()
   where event_id = p_event_id
     and code = v_code
     and checked_in_at is null
  returning * into r;

  if found then
    insert into public.checkin_events (event_id, attendee_id, code, kind, by_user, client_id, scanned_at, source)
    values (p_event_id, r.id, r.code, 'check_in', auth.uid(), p_client_id, v_at, v_src);
    return public.desk_card(r, 'ok');
  end if;

  -- Two copies of one request at once: the other one won; same answer.
  l := public.checkin_event_for_client(p_event_id, p_client_id, 'check_in', v_code, null);
  if l.id is not null then
    select * into r from public.attendees where id = l.attendee_id;
    return public.desk_card(r, 'ok')
           || jsonb_build_object('code', l.code, 'checked_in_at', l.scanned_at, 'replay', true);
  end if;

  select * into r from public.attendees
   where event_id = p_event_id and code = v_code;

  if found then
    return public.desk_card(r, 'dupe') || jsonb_build_object('checked_in_by_name', public.desk_name(r.checked_in_by));
  end if;

  return jsonb_build_object('status', 'unknown', 'code', v_code);
end $$;

revoke all on function public.check_in_by_code(uuid, text, timestamptz, text, text) from public, anon;
grant execute on function public.check_in_by_code(uuid, text, timestamptz, text, text) to authenticated, service_role;


drop function if exists public.undo_check_in(uuid, text);

create or replace function public.undo_check_in(
  p_event_id               uuid,
  p_code                   text,
  p_expected_checked_in_at timestamptz default null,
  p_source                 text default 'online'
) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_src  text;
  r      public.attendees%rowtype;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  v_src := public.desk_source(p_source);

  select * into r from public.attendees
   where event_id = p_event_id and code = v_code
   for update;

  if not found or r.checked_in_at is null then
    return jsonb_build_object('status', 'not_checked_in', 'code', v_code);
  end if;

  -- The desk is undoing the check-in it saw; someone undid and redid it since.
  if p_expected_checked_in_at is not null
     and abs(extract(epoch from (r.checked_in_at - p_expected_checked_in_at))) >= 1 then
    raise exception '% was checked in again since; not undone.', r.code
      using hint = 'checkin_changed', detail = to_json(r.checked_in_at) #>> '{}';
  end if;

  update public.attendees
     set checked_in_at = null,
         checked_in_by = null
   where id = r.id;

  insert into public.checkin_events (event_id, attendee_id, code, kind, by_user, scanned_at, source)
  values (p_event_id, r.id, r.code, 'undo', auth.uid(), now(), v_src);

  return jsonb_build_object('status', 'ok', 'code', r.code, 'name', r.name, 'checked_in_at', r.checked_in_at);
end $$;

revoke all on function public.undo_check_in(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.undo_check_in(uuid, text, timestamptz, text) to authenticated, service_role;


-- 3. record_scan ---------------------------------------------------------------

create or replace function public.record_scan(
  p_event_id     uuid,
  p_code         text,
  p_scan_type_id uuid,
  p_scanned_at   timestamptz default null,
  p_client_id    text default null,
  p_source       text default 'online'
) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_at   timestamptz;
  v_src  text;
  v_id   bigint;
  st     public.scan_types%rowtype;
  r      public.attendees%rowtype;
  l      public.checkin_events%rowtype;
  v_type jsonb;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  perform public.check_client_id(p_client_id);
  v_src := public.desk_source(p_source);

  select * into st from public.scan_types where id = p_scan_type_id and event_id = p_event_id;
  if not found then
    raise exception 'That scan type isn''t at this event.' using hint = 'scan_type';
  end if;
  v_type := jsonb_build_object('scan_type_id', st.id, 'label', st.label, 'kind', st.kind);
  v_at := public.clamp_desk_time(p_scanned_at);

  l := public.checkin_event_for_client(p_event_id, p_client_id, 'scan', v_code, st.id);
  if l.id is null then
    select * into r from public.attendees where event_id = p_event_id and code = v_code;
    if not found then
      return jsonb_build_object('status', 'not_on_roster', 'code', v_code) || v_type;
    end if;

    insert into public.checkin_events (event_id, attendee_id, code, kind, scan_type_id, by_user, client_id,
                                       scanned_at, source, not_checked_in)
    values (p_event_id, r.id, r.code, 'scan', st.id, auth.uid(), p_client_id, v_at, v_src, r.checked_in_at is null)
    on conflict do nothing
    returning id into v_id;

    if v_id is not null then
      return public.desk_card(r, case when r.checked_in_at is null then 'not_checked_in' else 'ok' end)
             || v_type || jsonb_build_object('scanned_at', v_at);
    end if;

    -- Two copies of one request at once: the other one won.
    l := public.checkin_event_for_client(p_event_id, p_client_id, 'scan', v_code, st.id);
  end if;

  if l.id is not null then
    select * into r from public.attendees where id = l.attendee_id;
    return public.desk_card(r, case when l.not_checked_in then 'not_checked_in' else 'ok' end)
           || v_type || jsonb_build_object('code', l.code, 'scanned_at', l.scanned_at, 'replay', true);
  end if;

  select * into l from public.checkin_events
   where scan_type_id = st.id and attendee_id = r.id and kind = 'scan';
  return public.desk_card(r, 'already') || v_type
         || jsonb_build_object('first_scanned_at', l.scanned_at, 'by_name', public.desk_name(l.by_user));
end $$;

revoke all on function public.record_scan(uuid, text, uuid, timestamptz, text, text) from public, anon;
grant execute on function public.record_scan(uuid, text, uuid, timestamptz, text, text) to authenticated, service_role;
