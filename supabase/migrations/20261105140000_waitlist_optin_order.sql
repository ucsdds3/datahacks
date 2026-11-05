-- Event-day waitlist queue goes by when people asked for a spot.
--
-- Before: waitlisted hackers who opted in were offered spots in the order they
-- SUBMITTED their application (20261105033100_waitlist_release.sql, section 4).
-- Now: in the order they ASKED FOR A SPOT, applications.waitlist_opt_in_at,
-- earliest first; then submitted_at, created_at, id to break ties.
--
-- set_waitlist_opt_in already stamps waitlist_opt_in_at = now() on the first
-- opt-in, keeps it on a repeat opt-in, and clears it on opt-out, so opting out
-- and back in puts you at the back. It isn't changed.
--
-- Recreated with only the ORDER BY changed (same signatures, security, search
-- path, grants): waitlist_overview (its 'queue' list) and offer_waitlist_spots.
-- accept_walk_in, mark_no_shows and the rest don't rank the queue.
-- Also adds a matching partial index for the queue. Safe to re-run.

create index if not exists applications_waitlist_optin_queue_idx
  on public.applications (event_id, waitlist_opt_in_at, submitted_at)
  where applicant_type = 'hacker' and status = 'waitlisted' and waitlist_opt_in_at is not null;


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
             order by waitlist_opt_in_at, submitted_at nulls last, created_at, id)
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

  select array_agg(q.id order by q.waitlist_opt_in_at, q.submitted_at nulls last, q.created_at, q.id) into v_ids
    from (select a.id, a.waitlist_opt_in_at, a.submitted_at, a.created_at
            from public.applications a
           where a.event_id = p_event_id and a.applicant_type = 'hacker'
             and a.status = 'waitlisted' and a.waitlist_opt_in_at is not null
           order by a.waitlist_opt_in_at, a.submitted_at nulls last, a.created_at, a.id
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

-- Same grants as 20261105033100_waitlist_release.sql (create or replace keeps
-- them; restated so this file stands on its own).
revoke all on function public.waitlist_overview(uuid) from public, anon;
revoke all on function public.offer_waitlist_spots(uuid, integer) from public, anon;
grant execute on function public.waitlist_overview(uuid) to authenticated, service_role;
grant execute on function public.offer_waitlist_spots(uuid, integer) to authenticated, service_role;
