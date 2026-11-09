-- MLH Member Event consent (docs/mlh.md). Additive: new columns, a trigger
-- and one function; nothing existing changes.
--
-- events.mlh_required      the per-event switch. Off by default. Turn it on the
--                          day MLH approves the event:
--                            update events set mlh_required = true where code = 'DH27';
--                          While it's on, a hacker application can't be
--                          submitted without the two required MLH agreements.
--
-- On applications, one boolean and one timestamp per MLH checkbox:
--   mlh_code_of_conduct / _at   required: "I have read and agree to the MLH Code of Conduct."
--   mlh_data_sharing / _at      required: share my application with MLH, MLH Contest
--                               Terms and Conditions, MLH Privacy Policy
--   mlh_emails_opt_in / _at     optional: emails from MLH and DEV
-- The timestamps are the server's: an API request can't set or backdate them.
--
-- Who can change them:
--   - the applicant, on their own row: when inserting it or while it's a draft
--     (the existing row-level security), and after submitting through
--     agree_to_mlh() (the portal's "Agree to MLH's terms" card, for people who
--     applied before the switch was turned on);
--   - nobody else through the API: an organizer's update keeps what's there
--     (consent is the applicant's to give);
--   - the SQL editor / service role (no API role), for fixing data by hand.
--
-- The check runs only when a hacker application becomes submitted (insert, or
-- a draft being submitted), so people who applied before the switch was turned
-- on aren't blocked from anything else: decisions, release, check-in and
-- waitlist updates on their rows carry on as before.
--
-- SELECT on applications is granted column by column
-- (20261109180000_decisions_private.sql), so the new columns are granted here.

alter table public.events
  add column if not exists mlh_required boolean not null default false;

alter table public.applications
  add column if not exists mlh_code_of_conduct boolean not null default false,
  add column if not exists mlh_code_of_conduct_at timestamptz,
  add column if not exists mlh_data_sharing boolean not null default false,
  add column if not exists mlh_data_sharing_at timestamptz,
  add column if not exists mlh_emails_opt_in boolean not null default false,
  add column if not exists mlh_emails_opt_in_at timestamptz;

grant select (mlh_code_of_conduct, mlh_code_of_conduct_at, mlh_data_sharing, mlh_data_sharing_at,
              mlh_emails_opt_in, mlh_emails_opt_in_at)
  on table public.applications to anon, authenticated;


-- The guard. Not security definer, on purpose: current_user is the caller's
-- API role (anon / authenticated), like applications_guard_waitlist. Inside a
-- security-definer function (agree_to_mlh) it's the function's owner.
create or replace function public.applications_mlh_consent() returns trigger
  language plpgsql
  set search_path to 'public'
as $$
declare
  v_api boolean := current_user in ('anon', 'authenticated');
begin
  new.mlh_code_of_conduct := coalesce(new.mlh_code_of_conduct, false);
  new.mlh_data_sharing    := coalesce(new.mlh_data_sharing, false);
  new.mlh_emails_opt_in   := coalesce(new.mlh_emails_opt_in, false);

  -- Only the applicant gives consent. Anyone else's API request keeps what's there.
  if v_api and auth.uid() is distinct from new.user_id then
    if tg_op = 'INSERT' then
      new.mlh_code_of_conduct := false;
      new.mlh_data_sharing    := false;
      new.mlh_emails_opt_in   := false;
    else
      new.mlh_code_of_conduct := old.mlh_code_of_conduct;
      new.mlh_data_sharing    := old.mlh_data_sharing;
      new.mlh_emails_opt_in   := old.mlh_emails_opt_in;
    end if;
  end if;

  -- When each was given: cleared when withdrawn (a draft unticked, or the
  -- emails opt-out). For API requests, the server's clock, kept once given.
  -- Without an API role (SQL editor, service role, agree_to_mlh) a time that's
  -- there is kept or can be corrected by hand; a missing one is now().
  new.mlh_code_of_conduct_at := case
    when not new.mlh_code_of_conduct then null
    when v_api and tg_op = 'UPDATE' and old.mlh_code_of_conduct then old.mlh_code_of_conduct_at
    when v_api then now()
    else coalesce(new.mlh_code_of_conduct_at, now()) end;
  new.mlh_data_sharing_at := case
    when not new.mlh_data_sharing then null
    when v_api and tg_op = 'UPDATE' and old.mlh_data_sharing then old.mlh_data_sharing_at
    when v_api then now()
    else coalesce(new.mlh_data_sharing_at, now()) end;
  new.mlh_emails_opt_in_at := case
    when not new.mlh_emails_opt_in then null
    when v_api and tg_op = 'UPDATE' and old.mlh_emails_opt_in then old.mlh_emails_opt_in_at
    when v_api then now()
    else coalesce(new.mlh_emails_opt_in_at, now()) end;

  -- The switch: submitting a hacker application needs both required agreements.
  if new.applicant_type = 'hacker'
     and new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted')
     and not (new.mlh_code_of_conduct and new.mlh_data_sharing)
     and exists (select 1 from public.events e where e.id = new.event_id and e.mlh_required) then
    raise exception 'To apply, agree to the MLH Code of Conduct and to sharing your application with MLH (the MLH checkboxes).'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function public.applications_mlh_consent() from public, anon;
grant execute on function public.applications_mlh_consent() to authenticated, service_role;

drop trigger if exists applications_mlh_consent on public.applications;
create trigger applications_mlh_consent before insert or update on public.applications
  for each row execute function public.applications_mlh_consent();


-- The portal card for people who applied before the switch was turned on:
-- agrees to both required checkboxes and sets the optional emails one, on the
-- signed-in person's own hacker application for the event. Calling it again
-- keeps the first agreement's time and can switch the emails off or on.
create or replace function public.agree_to_mlh(p_event_id uuid, p_emails_opt_in boolean default false)
  returns jsonb
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

  update public.applications
     set mlh_code_of_conduct = true,
         mlh_data_sharing    = true,
         mlh_emails_opt_in   = coalesce(p_emails_opt_in, false)
   where id = v_app.id
  returning * into v_app;

  return jsonb_build_object(
    'mlh_code_of_conduct_at', v_app.mlh_code_of_conduct_at,
    'mlh_data_sharing_at', v_app.mlh_data_sharing_at,
    'mlh_emails_opt_in', v_app.mlh_emails_opt_in,
    'mlh_emails_opt_in_at', v_app.mlh_emails_opt_in_at);
end $$;

revoke all on function public.agree_to_mlh(uuid, boolean) from public, anon;
grant execute on function public.agree_to_mlh(uuid, boolean) to authenticated, service_role;
