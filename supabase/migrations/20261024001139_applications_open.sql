-- An "applications open" switch per event (launch tracker C9). Before this,
-- anyone signed in could submit an application to any event (DH26, DH27BETA,
-- the real DH27 before launch) by calling the API directly.
--
-- events.applications_open     the switch. Off by default, so a new event takes
--                              no applications until an organizer turns it on.
-- events.applications_open_at  optional; only shown on the apply pages
--                              ("Applications open on November 3, 2026"). It
--                              doesn't open anything by itself.
--
-- The check: an applicant (any signed-in request that isn't from an organizer
-- of the event) can only create an application, or submit a draft, for an
-- event whose switch is on. Exempt:
--   - organizers of the event (deciding, releasing decisions, fixing rows);
--   - requests without a signed-in user: the service role (edge functions,
--     scripts), the SQL editor and migrations.
-- Updates that don't submit (linking an account to an application, decisions,
-- release_decisions, check-in) are never blocked, so closing applications
-- doesn't stop the rest of the event.
--
-- DH27BETA, the test event, stays open so the dev dummy-applicant script and
-- testers keep working. Every other event, the real DH27 included, starts
-- closed: turn it on in Table Editor -> events when applications open.

alter table public.events
  add column if not exists applications_open boolean not null default false,
  add column if not exists applications_open_at timestamptz;

update public.events set applications_open = true where upper(code) = 'DH27BETA';

create or replace function public.applications_require_open_event() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_event record;
begin
  -- No signed-in user: service role, SQL editor, migrations.
  if auth.uid() is null then
    return new;
  end if;

  -- Only creating an application or submitting a draft needs the event open.
  if tg_op = 'UPDATE'
     and not (new.status = 'submitted' and old.status is distinct from 'submitted') then
    return new;
  end if;

  if public.is_event_staff(new.event_id) then
    return new;
  end if;

  select e.name, e.applications_open, e.applications_open_at
    into v_event
    from public.events e
   where e.id = new.event_id;

  if coalesce(v_event.applications_open, false) then
    return new;
  end if;

  if v_event.applications_open_at > now() then
    raise exception 'Applications for % aren''t open yet. They open on %.',
        coalesce(v_event.name, 'this event'),
        to_char(v_event.applications_open_at at time zone 'America/Los_Angeles', 'FMMonth FMDD, YYYY')
      using errcode = 'check_violation';
  end if;
  raise exception 'Applications for % aren''t open right now.', coalesce(v_event.name, 'this event')
    using errcode = 'check_violation';
end $$;

revoke all on function public.applications_require_open_event() from public, anon, authenticated;
grant all on function public.applications_require_open_event() to service_role;

drop trigger if exists applications_require_open_event on public.applications;
create trigger applications_require_open_event before insert or update of status on public.applications
  for each row execute function public.applications_require_open_event();
