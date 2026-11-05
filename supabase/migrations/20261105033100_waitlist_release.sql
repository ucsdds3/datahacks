-- Event-day waitlist: close check-in, release no-shows' spots, offer them to
-- waitlisted hackers who asked to be told.
--
-- 1. public.event_day_settings, one row per event (organizers write; RLS):
--      hacker_capacity          how many hackers we want checked in
--      checkin_cutoff_at        check-in closes (everyone)
--      ucsd_checkin_cutoff_at   optional, a different cutoff for UC San Diego
--                               students (school on the application); last year
--                               UCSD closed at 10:30 and everyone else at 12:00
--      offer_window_minutes     how long someone offered a spot has to show up (default 60)
--
-- 2. New columns on applications, all nullable timestamps (nothing is deleted):
--      waitlist_opt_in_at          the applicant asked to be emailed if a spot opens
--      waitlist_offered_at         we gave them a spot (or let them in at the door)
--      waitlist_offer_expires_at   they have until then to check in
--      waitlist_offer_emailed_at   the "a spot opened up" email went out
--      no_show_at                  accepted, didn't check in by their deadline, and
--                                  an organizer pressed "Mark no-shows". Reversible.
--    Applicants can't write any of them directly (applications_guard_waitlist);
--    they opt in with set_waitlist_opt_in().
--
-- 3. Capacity. Every accepted hacker who hasn't checked in and isn't marked a
--    no-show holds a spot, offers included, so
--      open spots = capacity - checked-in hackers - accepted hackers still expected
--    (never below 0). Marking no-shows is what frees spots, and an offer is
--    only made into an open spot, so re-running an offer never over-fills.
--    Someone's deadline is their cutoff (UCSD's if they're at UCSD and one is
--    set), or, if they were offered a spot, the offer's expiry (the time in their email).
--    An expired offer is released the same way: mark them a no-show, then offer again.
--
-- 4. Queue order: waitlisted hackers who opted in, in the order they SUBMITTED
--    their application (applications.submitted_at, then created_at, then id).
--    When they opted in doesn't matter, so opting out and back in keeps your place.
--
-- 5. RPCs (organizers of the event only, like every other check-in RPC; the
--    applicant one checks it's their own application):
--      waitlist_overview(event)                    what the Day-of page shows
--      mark_no_shows(event)                        past-deadline, not checked in -> no_show_at
--      unmark_no_shows(event, application_ids)     undo
--      offer_waitlist_spots(event, n)              next n opted-in waitlisters -> accepted
--      accept_walk_in(event, application_id)       one waitlister or no-show, at the door
--      lookup_not_on_roster(event, code_or_email)  why someone can't be checked in
--      set_waitlist_opt_in(event, opt_in)          the applicant's toggle
--    Accepting goes through the existing triggers (promote_accepted gives the
--    hacker role, upsert_attendee makes the roster row and check-in code).
--
-- 6. A no-show's code stops checking in (attendees_block_no_show_checkin), so
--    a spot that was given away can't be taken back at the door by mistake.
--    check_in_by_code itself isn't replaced: it raises the trigger's error
--    (hint 'no_show'), and the desk can look them up and accept_walk_in them.
--
-- Additive: one new table, new nullable columns, new functions and triggers.
-- No existing function is replaced. Safe to re-run.

-- 1. Settings ---------------------------------------------------------------

create table if not exists public.event_day_settings (
  event_id               uuid primary key references public.events(id) on delete cascade,
  hacker_capacity        integer check (hacker_capacity is null or hacker_capacity between 0 and 10000),
  checkin_cutoff_at      timestamptz,
  ucsd_checkin_cutoff_at timestamptz,
  offer_window_minutes   integer not null default 60 check (offer_window_minutes between 5 and 600),
  updated_at             timestamptz not null default now(),
  updated_by             uuid
);

comment on table public.event_day_settings is
  'Event-day check-in settings: hacker capacity, check-in cutoffs, how long a released waitlist spot is held. Organizers of the event only.';

alter table public.event_day_settings enable row level security;

revoke all on table public.event_day_settings from public, anon, authenticated;
grant select, insert, update on table public.event_day_settings to authenticated;
grant all on table public.event_day_settings to service_role;

-- is_event_staff is "organizer of the event"; the check-in desk signs in as one.
drop policy if exists "event_day_settings staff read" on public.event_day_settings;
create policy "event_day_settings staff read" on public.event_day_settings for select to authenticated
  using (public.is_event_staff(event_id));
drop policy if exists "event_day_settings organizer insert" on public.event_day_settings;
create policy "event_day_settings organizer insert" on public.event_day_settings for insert to authenticated
  with check (public.is_event_staff(event_id));
drop policy if exists "event_day_settings organizer update" on public.event_day_settings;
create policy "event_day_settings organizer update" on public.event_day_settings for update to authenticated
  using (public.is_event_staff(event_id)) with check (public.is_event_staff(event_id));

create or replace function public.event_day_settings_stamp() returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

revoke all on function public.event_day_settings_stamp() from public, anon, authenticated;
grant all on function public.event_day_settings_stamp() to service_role;

drop trigger if exists event_day_settings_stamp on public.event_day_settings;
create trigger event_day_settings_stamp before insert or update on public.event_day_settings
  for each row execute function public.event_day_settings_stamp();


-- 2. Application columns ----------------------------------------------------

alter table public.applications
  add column if not exists waitlist_opt_in_at        timestamptz,
  add column if not exists waitlist_offered_at       timestamptz,
  add column if not exists waitlist_offer_expires_at timestamptz,
  add column if not exists waitlist_offer_emailed_at timestamptz,
  add column if not exists no_show_at                timestamptz;

create index if not exists applications_waitlist_queue_idx on public.applications (event_id, submitted_at)
  where applicant_type = 'hacker' and status = 'waitlisted' and waitlist_opt_in_at is not null;

-- Applicants can still edit their own draft row through the API, so these
-- columns are kept as they were for anyone who isn't an organizer of the
-- event. Runs as the caller (no security definer): inside the RPCs below the
-- statement runs as the function owner, which is allowed through.
create or replace function public.applications_guard_waitlist() returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_event_staff(new.event_id) then
    if tg_op = 'INSERT' then
      new.waitlist_opt_in_at        := null;
      new.waitlist_offered_at       := null;
      new.waitlist_offer_expires_at := null;
      new.waitlist_offer_emailed_at := null;
      new.no_show_at                := null;
    else
      new.waitlist_opt_in_at        := old.waitlist_opt_in_at;
      new.waitlist_offered_at       := old.waitlist_offered_at;
      new.waitlist_offer_expires_at := old.waitlist_offer_expires_at;
      new.waitlist_offer_emailed_at := old.waitlist_offer_emailed_at;
      new.no_show_at                := old.no_show_at;
    end if;
  end if;
  return new;
end $$;

revoke all on function public.applications_guard_waitlist() from public, anon;
grant execute on function public.applications_guard_waitlist() to authenticated, service_role;

drop trigger if exists applications_guard_waitlist on public.applications;
create trigger applications_guard_waitlist before insert or update on public.applications
  for each row execute function public.applications_guard_waitlist();


-- 3. Helpers (not callable through the API) ---------------------------------

-- UC San Diego, as the hacker form's school list spells it, or a common short name.
create or replace function public.is_ucsd_school(p_school text) returns boolean
  language sql immutable
  set search_path to 'public'
as $$
  select coalesce(p_school ~* '^\s*(university of california,?\s+san diego|uc\s+san\s+diego|ucsd)\s*$', false)
$$;

-- When someone has to be checked in by: the time their offer email gave them,
-- if they were offered a spot, otherwise their cutoff.
create or replace function public.hacker_checkin_deadline(
  p_school text, p_offer_expires_at timestamptz, p_cutoff timestamptz, p_ucsd_cutoff timestamptz
) returns timestamptz
  language sql immutable
  set search_path to 'public'
as $$
  select coalesce(
    p_offer_expires_at,
    case when public.is_ucsd_school(p_school) then coalesce(p_ucsd_cutoff, p_cutoff) else p_cutoff end)
$$;

-- Capacity, checked-in hackers, hackers still expected, open spots (null with no capacity).
create or replace function public.waitlist_capacity(p_event_id uuid)
  returns table(hacker_capacity integer, checked_in integer, expected integer, open_spots integer)
  language sql stable security definer
  set search_path to 'public'
as $$
  with ci as (
    select count(*)::int as n from public.attendees t
     where t.event_id = p_event_id and 'hacker' = any (t.roles) and t.checked_in_at is not null
  ), ex as (
    select count(*)::int as n from public.applications a
     where a.event_id = p_event_id and a.applicant_type = 'hacker' and a.status = 'accepted'
       and a.no_show_at is null
       and not exists (select 1 from public.attendees t where t.application_id = a.id and t.checked_in_at is not null)
  )
  select s.hacker_capacity, ci.n, ex.n,
         case when s.hacker_capacity is null then null else greatest(s.hacker_capacity - ci.n - ex.n, 0) end
    from ci cross join ex
    left join public.event_day_settings s on s.event_id = p_event_id
$$;

revoke all on function public.is_ucsd_school(text) from public, anon, authenticated;
revoke all on function public.hacker_checkin_deadline(text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.waitlist_capacity(uuid) from public, anon, authenticated;
grant execute on function public.is_ucsd_school(text) to service_role;
grant execute on function public.hacker_checkin_deadline(text, timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function public.waitlist_capacity(uuid) to service_role;

-- One waitlist change at a time per event (offers, no-shows, walk-ins).
create or replace function public.lock_event_waitlist(p_event_id uuid) returns void
  language sql
  set search_path to 'public'
as $$
  select pg_advisory_xact_lock(hashtext('waitlist:' || p_event_id::text))
$$;

revoke all on function public.lock_event_waitlist(uuid) from public, anon, authenticated;
grant execute on function public.lock_event_waitlist(uuid) to service_role;


-- 4. The applicant's toggle -------------------------------------------------

create or replace function public.set_waitlist_opt_in(p_event_id uuid, p_opt_in boolean)
  returns timestamptz
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_app public.applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  select * into v_app from public.applications
   where user_id = auth.uid() and event_id = p_event_id and applicant_type = 'hacker'
   for update;
  if not found then
    raise exception 'You don''t have a hacker application for this event.';
  end if;
  if v_app.status is distinct from 'waitlisted' then
    raise exception 'Only waitlisted applications can ask for a spot on the day.';
  end if;

  update public.applications
     set waitlist_opt_in_at = case when coalesce(p_opt_in, false)
                                   then coalesce(waitlist_opt_in_at, now()) end
   where id = v_app.id
  returning waitlist_opt_in_at into v_app.waitlist_opt_in_at;
  return v_app.waitlist_opt_in_at;
end $$;

revoke all on function public.set_waitlist_opt_in(uuid, boolean) from public, anon;
grant execute on function public.set_waitlist_opt_in(uuid, boolean) to authenticated, service_role;


-- 5. Organizer RPCs ---------------------------------------------------------

-- Everything the console's Day-of page shows, in one call.
create or replace function public.waitlist_overview(p_event_id uuid) returns jsonb
  language plpgsql stable security definer
  set search_path to 'public'
as $$
declare
  s   public.event_day_settings%rowtype;
  cap record;
  v   jsonb;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;

  select * into s from public.event_day_settings where event_id = p_event_id;
  select * into cap from public.waitlist_capacity(p_event_id);

  with apps as (
    select a.*,
           coalesce(nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''), 'Unknown') as full_name,
           coalesce(nullif(btrim(a.email), ''), p.email) as contact,
           t.code, t.checked_in_at,
           public.hacker_checkin_deadline(a.school, a.waitlist_offer_expires_at, s.checkin_cutoff_at, s.ucsd_checkin_cutoff_at) as deadline
      from public.applications a
      left join public.profiles p on p.id = a.user_id
      left join public.attendees t on t.application_id = a.id
     where a.event_id = p_event_id and a.applicant_type = 'hacker'
       and a.status in ('accepted', 'waitlisted')
  )
  select jsonb_build_object(
    'now', now(),
    'settings', jsonb_build_object(
      'hacker_capacity', s.hacker_capacity,
      'checkin_cutoff_at', s.checkin_cutoff_at,
      'ucsd_checkin_cutoff_at', s.ucsd_checkin_cutoff_at,
      'offer_window_minutes', coalesce(s.offer_window_minutes, 60)),
    'checked_in', cap.checked_in,
    'expected', cap.expected,
    'open_spots', cap.open_spots,
    'waitlisted', (select count(*) from apps where status = 'waitlisted'),
    -- Accepted, not checked in, not marked: everyone still holding a spot.
    'absent', coalesce((
      select jsonb_agg(jsonb_build_object(
               'application_id', id, 'name', full_name, 'email', contact, 'code', code,
               'ucsd', public.is_ucsd_school(school), 'deadline', deadline,
               'past_deadline', deadline is not null and deadline <= now(),
               'offered_at', waitlist_offered_at)
             order by deadline nulls last, full_name)
        from apps where status = 'accepted' and checked_in_at is null and no_show_at is null), '[]'),
    'no_shows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'application_id', id, 'name', full_name, 'email', contact, 'code', code, 'no_show_at', no_show_at)
             order by no_show_at desc, full_name)
        from apps where status = 'accepted' and no_show_at is not null), '[]'),
    'queue', coalesce((
      select jsonb_agg(jsonb_build_object(
               'application_id', id, 'name', full_name, 'email', contact,
               'submitted_at', submitted_at, 'opted_in_at', waitlist_opt_in_at)
             order by submitted_at nulls last, created_at, id)
        from apps where status = 'waitlisted' and waitlist_opt_in_at is not null), '[]'),
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'application_id', id, 'name', full_name, 'email', contact, 'code', code,
               'offered_at', waitlist_offered_at, 'expires_at', waitlist_offer_expires_at,
               'emailed_at', waitlist_offer_emailed_at, 'checked_in_at', checked_in_at,
               'no_show_at', no_show_at)
             order by waitlist_offered_at desc, full_name)
        from apps where status = 'accepted' and waitlist_offered_at is not null), '[]')
  ) into v;
  return v;
end $$;

-- Marks every accepted hacker who's past their deadline and not checked in.
-- Re-running only marks people who've passed their deadline since.
create or replace function public.mark_no_shows(p_event_id uuid)
  returns table(application_id uuid, name text)
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  s public.event_day_settings%rowtype;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  select * into s from public.event_day_settings where event_id = p_event_id;
  if s.checkin_cutoff_at is null then
    raise exception 'Set the check-in cutoff first.';
  end if;
  perform public.lock_event_waitlist(p_event_id);

  -- Hold their roster rows, so a check-in racing this either lands first (and
  -- they aren't marked) or waits and is refused.
  perform 1 from public.attendees t
    join public.applications a on a.id = t.application_id
   where a.event_id = p_event_id and a.applicant_type = 'hacker' and a.status = 'accepted'
     and a.no_show_at is null and t.checked_in_at is null
   for update of t;

  return query
  update public.applications a
     set no_show_at = now()
   where a.event_id = p_event_id and a.applicant_type = 'hacker' and a.status = 'accepted'
     and a.no_show_at is null
     and public.hacker_checkin_deadline(a.school, a.waitlist_offer_expires_at, s.checkin_cutoff_at, s.ucsd_checkin_cutoff_at) <= now()
     and not exists (select 1 from public.attendees t where t.application_id = a.id and t.checked_in_at is not null)
  returning a.id, coalesce(nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''), 'Unknown');
end $$;

-- Undo for "Mark no-shows". Not limited by capacity: it puts back what was there.
create or replace function public.unmark_no_shows(p_event_id uuid, p_application_ids uuid[])
  returns integer
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  n integer;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  perform public.lock_event_waitlist(p_event_id);
  update public.applications
     set no_show_at = null
   where event_id = p_event_id and id = any (coalesce(p_application_ids, '{}')) and no_show_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Accepts one waitlisted hacker into a spot (the caller has checked there's one
-- and holds the event's waitlist lock). The status change fires the existing
-- triggers: hacker role, roster row, check-in code.
create or replace function public.give_waitlist_spot(p_application_id uuid, p_window_minutes integer)
  returns void
  language sql
  set search_path to 'public'
as $$
  update public.applications
     set status = 'accepted',
         decision = 'accepted',
         decision_released_at = now(),
         waitlist_offered_at = now(),
         waitlist_offer_expires_at = now() + make_interval(mins => coalesce(p_window_minutes, 60)),
         waitlist_offer_emailed_at = null,
         no_show_at = null
   where id = p_application_id and status = 'waitlisted'
$$;

revoke all on function public.give_waitlist_spot(uuid, integer) from public, anon, authenticated;
grant execute on function public.give_waitlist_spot(uuid, integer) to service_role;

-- Offers up to p_count open spots to the next opted-in waitlisters, in queue
-- order. Never more than the open spots; people offered now hold a spot, so
-- running it again (or twice at once) can't offer the same spots twice.
create or replace function public.offer_waitlist_spots(p_event_id uuid, p_count integer)
  returns table(application_id uuid, name text, email text, code text, offer_expires_at timestamptz)
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  s      public.event_day_settings%rowtype;
  v_open integer;
  v_ids  uuid[];
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'Offer at least one spot.';
  end if;
  select * into s from public.event_day_settings where event_id = p_event_id;
  if s.hacker_capacity is null then
    raise exception 'Set the hacker capacity first.';
  end if;
  perform public.lock_event_waitlist(p_event_id);

  select c.open_spots into v_open from public.waitlist_capacity(p_event_id) c;
  if coalesce(v_open, 0) < 1 then
    return;
  end if;

  select array_agg(q.id order by q.submitted_at nulls last, q.created_at, q.id) into v_ids
    from (select a.id, a.submitted_at, a.created_at
            from public.applications a
           where a.event_id = p_event_id and a.applicant_type = 'hacker'
             and a.status = 'waitlisted' and a.waitlist_opt_in_at is not null
           order by a.submitted_at nulls last, a.created_at, a.id
           limit least(p_count, v_open)
           for update of a) q;

  if v_ids is null then
    return;
  end if;
  perform public.give_waitlist_spot(x, s.offer_window_minutes) from unnest(v_ids) as x;

  return query
  select a.id,
         coalesce(nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''), 'Unknown'),
         coalesce(nullif(btrim(a.email), ''), p.email),
         t.code,
         a.waitlist_offer_expires_at
    from unnest(v_ids) with ordinality as x(id, ord)
    join public.applications a on a.id = x.id
    left join public.profiles p on p.id = a.user_id
    left join public.attendees t on t.application_id = a.id
   order by x.ord;
end $$;

-- At the door: lets in one waitlisted hacker (opted in or not) or one marked
-- no-show, if there's an open spot. Returns their check-in code; the desk then
-- checks them in as usual. Outcomes, in 'status':
--   accepted          was waitlisted, now accepted with a code
--   readmitted        was a no-show, unmarked
--   already_accepted  already on the roster; nothing changed
--   full              no open spot; nothing changed
--   not_eligible      rejected, not submitted, or not a hacker; nothing changed
create or replace function public.accept_walk_in(p_event_id uuid, p_application_id uuid) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  s      public.event_day_settings%rowtype;
  a      public.applications%rowtype;
  v_open integer;
  v_out  text;
  v_code text;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  select * into s from public.event_day_settings where event_id = p_event_id;
  if s.hacker_capacity is null then
    raise exception 'Set the hacker capacity first.';
  end if;
  perform public.lock_event_waitlist(p_event_id);

  select * into a from public.applications where id = p_application_id and event_id = p_event_id for update;
  if not found then
    raise exception 'That application isn''t at this event.';
  end if;
  if a.applicant_type <> 'hacker' or a.status not in ('waitlisted', 'accepted') then
    return jsonb_build_object('status', 'not_eligible', 'application_status', a.status);
  end if;

  if a.status = 'accepted' and a.no_show_at is null then
    v_out := 'already_accepted';
  else
    select c.open_spots into v_open from public.waitlist_capacity(p_event_id) c;
    if coalesce(v_open, 0) < 1 then
      return jsonb_build_object('status', 'full', 'open_spots', 0);
    end if;
    if a.status = 'waitlisted' then
      perform public.give_waitlist_spot(a.id, s.offer_window_minutes);
      v_out := 'accepted';
    else
      update public.applications set no_show_at = null where id = a.id;
      v_out := 'readmitted';
    end if;
  end if;

  select t.code into v_code from public.attendees t where t.application_id = a.id;
  return jsonb_build_object(
    'status', v_out, 'application_id', a.id, 'code', v_code,
    'name', coalesce(nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''), 'Unknown'));
end $$;

-- For the check-in desk when a code or email doesn't check in: why not. Only
-- the name, status and reason (plus the application id, for accept_walk_in, and
-- the code when they have one). reason is one of:
--   on_roster           accepted and can be checked in (code included)
--   already_checked_in
--   no_show             accepted, marked a no-show (accept_walk_in can readmit)
--   waitlisted          (opted_in / offer fields say more)
--   rejected
--   not_decided         submitted, no decision released
--   not_submitted       a draft
--   wrong_event         applied to, or has a code for, a different event (its name only)
--   never_applied       no application with that email at this event
--   unknown_code        no such code at any event
create or replace function public.lookup_not_on_roster(p_event_id uuid, p_code_or_email text) returns jsonb
  language plpgsql stable security definer
  set search_path to 'public'
as $$
declare
  v_q     text := btrim(coalesce(p_code_or_email, ''));
  v_app   public.applications%rowtype;
  v_att   public.attendees%rowtype;
  v_other text;
  v_reason text;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if v_q = '' then
    raise exception 'Enter a check-in code or an email address.';
  end if;

  if position('@' in v_q) = 0 then
    -- A check-in code.
    select * into v_att from public.attendees where event_id = p_event_id and code = upper(v_q);
    if not found then
      select e.name into v_other from public.attendees t join public.events e on e.id = t.event_id
       where upper(t.code) = upper(v_q) limit 1;
      return jsonb_build_object('reason', case when v_other is null then 'unknown_code' else 'wrong_event' end,
                                'event_name', v_other);
    end if;
    select * into v_app from public.applications where id = v_att.application_id;
  else
    -- An email: the application's own, or the account's.
    select a.* into v_app
      from public.applications a
      left join public.profiles p on p.id = a.user_id
     where a.event_id = p_event_id
       and lower(v_q) in (lower(btrim(a.email)), lower(p.email))
     order by (a.applicant_type = 'hacker') desc, a.created_at
     limit 1;
    if not found then
      select e.name into v_other
        from public.applications a
        left join public.profiles p on p.id = a.user_id
        join public.events e on e.id = a.event_id
       where a.event_id <> p_event_id and lower(v_q) in (lower(btrim(a.email)), lower(p.email))
       order by e.starts_at desc nulls last
       limit 1;
      return jsonb_build_object('reason', case when v_other is null then 'never_applied' else 'wrong_event' end,
                                'event_name', v_other);
    end if;
    select * into v_att from public.attendees where application_id = v_app.id;
  end if;

  v_reason := case
    when v_att.checked_in_at is not null then 'already_checked_in'
    when v_app.id is null then 'on_roster'
    when v_app.status = 'accepted' and v_app.no_show_at is not null then 'no_show'
    when v_app.status = 'accepted' then 'on_roster'
    when v_app.status = 'waitlisted' then 'waitlisted'
    when v_app.status = 'rejected' then 'rejected'
    when v_app.status = 'submitted' then 'not_decided'
    else 'not_submitted'
  end;

  return jsonb_build_object(
    'reason', v_reason,
    'name', coalesce(nullif(btrim(concat_ws(' ', v_app.first_name, v_app.last_name)), ''), v_att.name, 'Unknown'),
    'status', v_app.status,
    'applicant_type', v_app.applicant_type,
    'application_id', v_app.id,
    'code', v_att.code,
    'opted_in', v_app.waitlist_opt_in_at is not null,
    'offered_at', v_app.waitlist_offered_at,
    'offer_expires_at', v_app.waitlist_offer_expires_at);
end $$;

revoke all on function public.waitlist_overview(uuid) from public, anon;
revoke all on function public.mark_no_shows(uuid) from public, anon;
revoke all on function public.unmark_no_shows(uuid, uuid[]) from public, anon;
revoke all on function public.offer_waitlist_spots(uuid, integer) from public, anon;
revoke all on function public.accept_walk_in(uuid, uuid) from public, anon;
revoke all on function public.lookup_not_on_roster(uuid, text) from public, anon;
grant execute on function public.waitlist_overview(uuid) to authenticated, service_role;
grant execute on function public.mark_no_shows(uuid) to authenticated, service_role;
grant execute on function public.unmark_no_shows(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.offer_waitlist_spots(uuid, integer) to authenticated, service_role;
grant execute on function public.accept_walk_in(uuid, uuid) to authenticated, service_role;
grant execute on function public.lookup_not_on_roster(uuid, text) to authenticated, service_role;


-- 6. A no-show's code doesn't check in --------------------------------------

create or replace function public.attendees_block_no_show_checkin() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
begin
  -- Signed-in requests only: the SQL editor and service role can still fix rows.
  if new.checked_in_at is not null and old.checked_in_at is null and auth.uid() is not null
     and exists (select 1 from public.applications a where a.id = new.application_id and a.no_show_at is not null) then
    raise exception '% was marked a no-show after check-in closed. Look them up to let them in if there''s room.', new.code
      using hint = 'no_show';
  end if;
  return new;
end $$;

revoke all on function public.attendees_block_no_show_checkin() from public, anon, authenticated;
grant all on function public.attendees_block_no_show_checkin() to service_role;

drop trigger if exists attendees_block_no_show_checkin on public.attendees;
create trigger attendees_block_no_show_checkin before update of checked_in_at on public.attendees
  for each row execute function public.attendees_block_no_show_checkin();
