-- "We've received your application" emails (edge function send-received-email,
-- and the MCP server's submit tools through the same shared code). Additive:
-- one new column, a guard trigger, a wider email_log.kind check and two
-- existing functions recreated with one extra branch each; nothing is dropped
-- or renamed, and existing kinds behave exactly as before.
--
-- applications.received_emailed_at   when the applicant was sent the "we've
--   received your application" email. Set by finish_email in the same
--   transaction that marks the email_log row sent, so a retry, a second tab or
--   a double click never sends a second one. Nobody can set it through the API
--   (applicants, organizers): only the edge functions (service role) and the
--   SQL editor.
--
-- Each email is claimed in email_log like every other (kind 'received', key
-- received:<application id>), so it counts against email_daily_limit() and the
-- usual claim rules apply. claim_email also answers 'sent' for an application
-- whose received_emailed_at is already set.
--
-- Who gets one: the edge function only sends for status = 'submitted' (under
-- review) and received_emailed_at is null. To keep the portal's fallback (it
-- asks again when an applicant opens their portal) from emailing everyone who
-- applied before this existed, applications submitted more than a day before
-- this migration runs are marked here as not needing one: their
-- received_emailed_at is set to this migration's time, and they have no
-- 'received' row in email_log (that's how to tell them apart from people who
-- were emailed). The last day's applicants are left due, because the site
-- (GitHub Pages) deploys before this migration and the function do, and their
-- submit may already have tried the not-yet-deployed function.
--
-- To email those earlier applicants after all (one-off), in the SQL editor:
--   update public.applications a set received_emailed_at = null
--    where a.status = 'submitted' and a.received_emailed_at is not null
--      and a.event_id = (select id from public.events where code = 'DH27')
--      and not exists (select 1 from public.email_log l
--                       where l.dedupe_key = 'received:' || a.id and l.status = 'sent');
-- then press "Send them now" on the console's Email page (or they get it the
-- next time they open the portal). Mind the daily limit: the console shows it.
--
-- SELECT on applications is granted column by column
-- (20261109180000_decisions_private.sql), so the new column is granted here.

alter table public.applications
  add column if not exists received_emailed_at timestamptz;

grant select (received_emailed_at) on table public.applications to anon, authenticated;


-- Only the server says when the email went out. Not security definer, on
-- purpose: current_user is the caller's API role (anon / authenticated), as in
-- applications_guard_waitlist. finish_email (security definer) and the SQL
-- editor run as the owner and are let through.
create or replace function public.applications_guard_received_email() returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.received_emailed_at := null;
    else
      new.received_emailed_at := old.received_emailed_at;
    end if;
  end if;
  return new;
end $$;

revoke all on function public.applications_guard_received_email() from public, anon;
grant execute on function public.applications_guard_received_email() to authenticated, service_role;

drop trigger if exists applications_guard_received_email on public.applications;
create trigger applications_guard_received_email before insert or update on public.applications
  for each row execute function public.applications_guard_received_email();


-- email_log.kind: add 'received'. The baseline's check is unnamed, so it's
-- found by what it checks; the new one has the same name Postgres gave it.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
     where conrelid = 'public.email_log'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ~ '\mkind\M'
  loop
    execute format('alter table public.email_log drop constraint %I', v_name);
  end loop;
end $$;

alter table public.email_log
  add constraint email_log_kind_check check (kind in ('decision', 'offer', 'blast', 'pass', 'received'));


-- As in 20261109180100_email_log.sql, plus: a 'received' email for an
-- application whose received_emailed_at is set counts as sent.
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
  -- One "we've received your application" email per application, ever
  -- (including applications marked as not needing one).
  if p_kind = 'received' and exists (
    select 1 from public.applications a
     where a.id = p_application_id
       and a.received_emailed_at is not null) then
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

-- As in 20261109180100_email_log.sql, plus: a 'received' email marks
-- applications.received_emailed_at (kept if it was already set).
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
    elsif r.kind = 'received' then
      update public.applications
         set received_emailed_at = coalesce(received_emailed_at, now())
       where id = r.application_id;
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


-- Applications from before these emails existed don't get one (see the top).
-- Only status 'submitted' is ever emailed, so only those rows are touched.
update public.applications
   set received_emailed_at = now()
 where status = 'submitted'
   and received_emailed_at is null
   and coalesce(submitted_at, created_at) < now() - interval '1 day';
