-- A record of every email the console sends (launch audit 3-organizer.md B1,
-- M5 and 8-integrations.md 2, 3, 5, 10). Additive: one new table and helper
-- functions; nothing existing changes.
--
-- Before: send-email marked decision_emailed_at only after its whole batch,
-- so a batch cut off by the 150 s function limit recorded nobody and a retry
-- emailed everyone again; blasts kept no record at all; nothing counted the
-- account's sends against Gmail's daily cap.
--
-- Now each email is
--   1. claimed  (claim_email): a row in email_log with status 'sending' and a
--      dedupe_key that says what it is, e.g. one decision for one person. The
--      unique index lets only one claim per key be live, so two organizers (or
--      a retry racing the original) can't both send it. Claims also stop at
--      the daily limit.
--   2. sent over SMTP by the edge function, then straight away
--   3. finished (finish_email): 'sent', and for decisions
--      applications.decision_emailed_at, for passes attendees.emailed_at, in
--      the same transaction. A failure marks the row 'failed', which frees the
--      key for a retry.
-- A claim whose function died mid-send stays 'sending'; after 10 minutes it
-- becomes 'abandoned' and the key can be claimed again. That's the only way a
-- person can get a second copy, and only of the one email in flight.
--
-- Keys (built by the edge functions):
--   decision:<application id>:<decision_released_at epoch>   decision emails and day-of offers
--   blast:<sha256 of event, subject and body>:<application id>   the same blast text reaches a person once
--   pass:<attendee id>:<emailed_at or never>:<email>          one pass per send round
--
-- The daily limit is email_daily_limit() (1,800, under Google Workspace's
-- 2,000 a day per account, leaving room for the team's own mail from the same
-- address). It counts every claim in the last 24 hours that didn't fail,
-- across all events, since they share one Gmail account.

create table if not exists public.email_log (
  id             bigint generated always as identity primary key,
  event_id       uuid not null references public.events(id) on delete cascade,
  kind           text not null check (kind in ('decision', 'offer', 'blast', 'pass')),
  dedupe_key     text not null check (char_length(dedupe_key) <= 300),
  application_id uuid references public.applications(id) on delete set null,
  status         text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'abandoned')),
  error          text check (char_length(error) <= 500),
  claimed_at     timestamptz not null default now(),
  sent_at        timestamptz,
  sent_by        uuid references auth.users(id) on delete set null
);

create unique index if not exists email_log_live_key on public.email_log (dedupe_key)
  where status in ('sending', 'sent');
create index if not exists email_log_recent on public.email_log (claimed_at)
  where status <> 'failed';
create index if not exists email_log_event on public.email_log (event_id, kind);

alter table public.email_log enable row level security;
revoke all on table public.email_log from public, anon, authenticated;
grant select on table public.email_log to authenticated;
grant all on table public.email_log to service_role;

drop policy if exists "email_log staff read" on public.email_log;
create policy "email_log staff read" on public.email_log for select to authenticated
  using (public.is_event_staff(event_id));


create or replace function public.email_daily_limit() returns integer
  language sql immutable
as $$ select 1800 $$;

-- Sends (and sends in flight) in the last 24 hours, every event.
create or replace function public.email_sends_last_day() returns integer
  language sql stable security definer
  set search_path to 'public'
as $$
  select count(*)::integer from public.email_log
   where status <> 'failed' and claimed_at > now() - interval '24 hours'
$$;

revoke all on function public.email_daily_limit() from public, anon;
grant execute on function public.email_daily_limit() to authenticated, service_role;
revoke all on function public.email_sends_last_day() from public, anon, authenticated;
grant execute on function public.email_sends_last_day() to service_role;

-- For the console: how many emails can still go out today.
--   { used, limit, remaining, frees_at }   frees_at: when the oldest counted send leaves the 24-hour window
create or replace function public.email_quota(p_event_id uuid) returns jsonb
  language plpgsql stable security definer
  set search_path to 'public'
as $$
declare
  v_used    integer := public.email_sends_last_day();
  v_limit   integer := public.email_daily_limit();
  v_oldest  timestamptz;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  select min(claimed_at) into v_oldest from public.email_log
   where status <> 'failed' and claimed_at > now() - interval '24 hours';
  return jsonb_build_object(
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(v_limit - v_used, 0),
    'frees_at', v_oldest + interval '24 hours');
end $$;

revoke all on function public.email_quota(uuid) from public, anon;
grant execute on function public.email_quota(uuid) to authenticated, service_role;


-- Claims one email. Returns
--   'claimed'  go ahead and send it, then call finish_email
--   'sent'     already sent (nothing to do)
--   'busy'     someone else is sending it right now
--   'quota'    the daily limit is reached; nothing more goes out today
-- Service role only (the edge functions, after checking the caller is an organizer).
create or replace function public.claim_email(
  p_event_id uuid, p_kind text, p_key text, p_application_id uuid, p_by uuid default null
) returns text
  language plpgsql security definer
  set search_path to 'public'
as $$
begin
  -- Claims one at a time, so the daily count can't be overshot by parallel sends.
  perform pg_advisory_xact_lock(hashtext('public.email_log'));

  update public.email_log set status = 'abandoned'
   where dedupe_key = p_key and status = 'sending' and claimed_at < now() - interval '10 minutes';

  if exists (select 1 from public.email_log where dedupe_key = p_key and status = 'sent') then
    return 'sent';
  end if;
  -- Decisions emailed before this log existed.
  if p_kind in ('decision', 'offer') and exists (
    select 1 from public.applications a
     where a.id = p_application_id
       and a.decision_emailed_at is not null
       and a.decision_released_at is not null
       and a.decision_emailed_at >= a.decision_released_at) then
    return 'sent';
  end if;
  if exists (select 1 from public.email_log where dedupe_key = p_key and status = 'sending') then
    return 'busy';
  end if;
  if public.email_sends_last_day() >= public.email_daily_limit() then
    return 'quota';
  end if;

  insert into public.email_log (event_id, kind, dedupe_key, application_id, sent_by)
  values (p_event_id, p_kind, p_key, p_application_id, p_by);
  return 'claimed';
end $$;

-- Records how a claimed email went. On success it also marks the person, in
-- the same transaction: decision and offer emails set
-- applications.decision_emailed_at (offers also waitlist_offer_emailed_at),
-- passes set attendees.emailed_at.
create or replace function public.finish_email(p_key text, p_ok boolean, p_error text default null) returns void
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  r public.email_log%rowtype;
begin
  if p_ok then
    update public.email_log set status = 'sent', sent_at = now(), error = null
     where dedupe_key = p_key and status in ('sending', 'abandoned')
     returning * into r;
    if not found then
      return;
    end if;
    if r.kind in ('decision', 'offer') then
      update public.applications
         set decision_emailed_at = now(),
             waitlist_offer_emailed_at = case when r.kind = 'offer' then now() else waitlist_offer_emailed_at end
       where id = r.application_id;
    elsif r.kind = 'pass' then
      update public.attendees set emailed_at = now()
       where application_id = r.application_id and event_id = r.event_id;
    end if;
  else
    update public.email_log set status = 'failed', error = left(coalesce(p_error, 'Failed'), 500)
     where dedupe_key = p_key and status = 'sending';
  end if;
end $$;

revoke all on function public.claim_email(uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_email(text, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_email(uuid, text, text, uuid, uuid) to service_role;
grant execute on function public.finish_email(text, boolean, text) to service_role;
