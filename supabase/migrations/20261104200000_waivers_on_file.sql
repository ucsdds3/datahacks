-- Signed liability waivers, recorded in the database so the check-in desk can
-- see them. Until now a signed waiver was only remembered in the signer's own
-- browser (localStorage), so nobody else could know.
--
-- 1. public.waivers: one row per event and person, written only by the
--    docusign-waiver edge function (service role) after DocuSign itself says
--    the caller's envelope is completed. Applicants can read their own row and
--    an event's organizers can read the event's rows; nobody signed in can
--    insert, update or delete (no grants, no write policies), so an applicant
--    can't mark themselves signed through the API.
--
-- 2. attendees.waiver_signed_at: a copy on the check-in roster, kept in step by
--    upsert_attendee (when someone is accepted, edited or linked) and by a
--    trigger on waivers (when the waiver arrives after the roster row). The
--    check-in app reads attendees, and check_in_by_code now returns the field
--    too. Attendees is already read-only for signed-in users.
--
-- Additive: a new table, a new nullable column, two functions replaced with the
-- same signatures and results plus one extra key. Safe to re-run.
--
-- Backfill: none is possible. Waivers signed before this migration were only
-- recorded in each signer's browser, and the portal re-checks with DocuSign the
-- next time the signer opens the waiver page (which records it here). DocuSign
-- production isn't live yet, so no real waivers exist; demo-env test envelopes
-- aren't backfilled on purpose.

create table if not exists public.waivers (
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- When DocuSign says they signed (or when we first saw it completed).
  signed_at   timestamptz not null,
  envelope_id text not null,
  recorded_at timestamptz not null default now(),
  primary key (event_id, user_id),
  constraint waivers_envelope_id_check
    check (char_length(envelope_id) <= 100 and envelope_id ~ '^[A-Za-z0-9-]+$')
);

comment on table public.waivers is
  'Signed liability waivers per event and person. Written only by the docusign-waiver edge function (service role).';

alter table public.waivers enable row level security;

-- Supabase's default privileges give anon/authenticated everything on a new
-- table; take that back so the only signed-in access is reading.
revoke all on table public.waivers from public, anon, authenticated;
grant select on table public.waivers to authenticated;
grant all on table public.waivers to service_role;

drop policy if exists "waivers self read" on public.waivers;
create policy "waivers self read" on public.waivers for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "waivers staff read" on public.waivers;
create policy "waivers staff read" on public.waivers for select to authenticated
  using (public.is_event_staff(event_id));


-- The roster's copy.
alter table public.attendees add column if not exists waiver_signed_at timestamptz;


-- Keeps attendees.waiver_signed_at in step when a waiver row changes.
create or replace function public.trg_sync_attendee_waiver() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.attendees
       set waiver_signed_at = null
     where event_id = old.event_id and user_id = old.user_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.attendees
       set waiver_signed_at = new.signed_at
     where event_id = new.event_id and user_id = new.user_id;
  end if;
  return null;
end $$;

revoke all on function public.trg_sync_attendee_waiver() from public, anon, authenticated;
grant all on function public.trg_sync_attendee_waiver() to service_role;

drop trigger if exists sync_attendee_waiver on public.waivers;
create trigger sync_attendee_waiver after insert or update or delete on public.waivers
  for each row execute function public.trg_sync_attendee_waiver();


-- As in the baseline, plus waiver_signed_at from public.waivers.
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

  select code into v_code from public.attendees where application_id = a.id;
  if v_code is null then
    perform pg_advisory_xact_lock(hashtext(a.event_id::text));
    v_code := public.next_attendee_code(a.event_id, v_roles);
  end if;

  insert into public.attendees (event_id, application_id, user_id, code, name, email, roles, waiver_signed_at)
  values (a.event_id, a.id, a.user_id, v_code, v_name, v_email, v_roles, v_waiver)
  on conflict (application_id) do update
    set user_id          = excluded.user_id,
        name             = excluded.name,
        email            = excluded.email,
        roles            = excluded.roles,
        waiver_signed_at = excluded.waiver_signed_at,
        emailed_at = case when public.attendees.email is distinct from excluded.email
                          then null else public.attendees.emailed_at end;
end $$;


-- As in the baseline, plus waiver_signed_at in the payload for the scan card.
create or replace function public.check_in_by_code(p_event_id uuid, p_code text) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  r      public.attendees%rowtype;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;

  update public.attendees
     set checked_in_at = now(),
         checked_in_by = auth.uid()
   where event_id = p_event_id
     and code = v_code
     and checked_in_at is null
  returning * into r;

  if found then
    return jsonb_build_object(
      'status', 'ok', 'code', r.code, 'name', r.name, 'roles', to_jsonb(r.roles),
      'team', r.team, 'checked_in_at', r.checked_in_at, 'waiver_signed_at', r.waiver_signed_at);
  end if;

  select * into r from public.attendees
   where event_id = p_event_id and code = v_code;

  if found then
    return jsonb_build_object(
      'status', 'dupe', 'code', r.code, 'name', r.name, 'roles', to_jsonb(r.roles),
      'team', r.team, 'checked_in_at', r.checked_in_at, 'waiver_signed_at', r.waiver_signed_at);
  end if;

  return jsonb_build_object('status', 'unknown', 'code', v_code);
end $$;


-- Roster rows made before this migration: copy any waivers across (none exist
-- yet; kept so a re-run stays correct).
update public.attendees att
   set waiver_signed_at = w.signed_at
  from public.waivers w
 where w.event_id = att.event_id and w.user_id = att.user_id
   and att.waiver_signed_at is distinct from w.signed_at;
