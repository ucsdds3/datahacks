-- Waivers through a DocuSign PowerForm (UC San Diego's campus account).
--
-- The portal now links to a PowerForm instead of embedding DocuSign through the
-- API, so DocuSign no longer tells us directly who signed. Organizers bring the
-- signatures in two ways:
--
-- 1. record_waivers_import(event, rows): the organizer console uploads the
--    PowerForm's CSV export, matches each completed envelope to an accepted
--    application (by the DataHacksID field, else by email), and sends the
--    matches here. Each row is { application_id, envelope_id, signed_at }.
--    Only that event's accepted applications with a portal account are
--    recorded; everything else is skipped with a reason. A person who already
--    has a waiver keeps the first one (idempotent).
--
-- 2. mark_waiver_seen(event, person, note): the check-in desk or the console
--    marks one person signed after seeing their DocuSign completion email.
--    `person` is an attendee id or an application id of that event.
--
-- public.waivers gains where each row came from (source), who recorded it
-- (recorded_by) and an optional note. envelope_id becomes optional, since a
-- desk mark has none. Rows the docusign-waiver edge function already wrote are
-- 'docusign_embedded' (the default, so the function keeps working unchanged).
--
-- Writes stay closed to signed-in users: no grants or policies change. The two
-- functions are security definer and check is_event_staff (organizers) first.
--
-- Additive (three nullable/defaulted columns, one check constraint, one
-- relaxed NOT NULL, two new functions). Safe to re-run.

alter table public.waivers
  add column if not exists source      text not null default 'docusign_embedded',
  add column if not exists recorded_by uuid references public.profiles(id) on delete set null,
  add column if not exists note        text;

alter table public.waivers alter column envelope_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waivers_source_check' and conrelid = 'public.waivers'::regclass) then
    alter table public.waivers add constraint waivers_source_check
      check (source in ('docusign_embedded', 'docusign_import', 'manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'waivers_note_check' and conrelid = 'public.waivers'::regclass) then
    alter table public.waivers add constraint waivers_note_check
      check (note is null or char_length(note) <= 500);
  end if;
end $$;

comment on table public.waivers is
  'Signed liability waivers per event and person. Written by the docusign-waiver edge function (service role) or by organizers through record_waivers_import / mark_waiver_seen.';
comment on column public.waivers.source is
  'docusign_embedded (edge function), docusign_import (PowerForm CSV import), manual (desk saw the completion email).';


-- 1. CSV import ---------------------------------------------------------------

create or replace function public.record_waivers_import(p_event_id uuid, p_rows jsonb) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  r          jsonb;
  v_app_id   uuid;
  v_envelope text;
  v_signed   timestamptz;
  a          public.applications%rowtype;
  v_inserted int;
  n_recorded int := 0;
  n_already  int := 0;
  skipped    jsonb := '[]'::jsonb;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'At most 2000 rows per call' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_app_id := null;
    begin
      v_app_id := nullif(r->>'application_id', '')::uuid;
    exception when invalid_text_representation then
      v_app_id := null;
    end;
    if v_app_id is null then
      skipped := skipped || jsonb_build_object('application_id', r->'application_id', 'reason', 'bad_id');
      continue;
    end if;

    v_envelope := nullif(btrim(coalesce(r->>'envelope_id', '')), '');
    if v_envelope is not null and (char_length(v_envelope) > 100 or v_envelope !~ '^[A-Za-z0-9-]+$') then
      skipped := skipped || jsonb_build_object('application_id', v_app_id, 'reason', 'bad_envelope');
      continue;
    end if;

    v_signed := null;
    begin
      v_signed := nullif(r->>'signed_at', '')::timestamptz;
    exception when others then
      v_signed := null;
    end;
    -- No (or a future) completion time: the time we recorded it.
    v_signed := least(coalesce(v_signed, now()), now());

    select * into a from public.applications where id = v_app_id and event_id = p_event_id;
    if not found then
      skipped := skipped || jsonb_build_object('application_id', v_app_id, 'reason', 'not_in_event');
      continue;
    end if;
    if a.status is distinct from 'accepted' then
      skipped := skipped || jsonb_build_object('application_id', v_app_id, 'reason', 'not_accepted');
      continue;
    end if;
    if a.user_id is null then
      skipped := skipped || jsonb_build_object('application_id', v_app_id, 'reason', 'no_account');
      continue;
    end if;

    insert into public.waivers (event_id, user_id, signed_at, envelope_id, source, recorded_by)
    values (p_event_id, a.user_id, v_signed, v_envelope, 'docusign_import', auth.uid())
    on conflict (event_id, user_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted > 0 then n_recorded := n_recorded + 1; else n_already := n_already + 1; end if;
  end loop;

  return jsonb_build_object(
    'recorded', n_recorded,
    'already_on_file', n_already,
    'skipped', jsonb_array_length(skipped),
    'skipped_rows', skipped);
end $$;

revoke all on function public.record_waivers_import(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_waivers_import(uuid, jsonb) to authenticated, service_role;


-- 2. Desk / console mark ------------------------------------------------------

create or replace function public.mark_waiver_seen(p_event_id uuid, p_person_id uuid, p_note text default null) returns jsonb
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_app_id uuid;
  a        public.applications%rowtype;
  v_code   text;
  v_name   text;
  w        public.waivers%rowtype;
  v_note   text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  -- Also how the check-in app tells whether this function exists: a call
  -- without a person changes nothing and answers this error.
  if p_person_id is null then
    raise exception 'Say whose waiver to mark' using errcode = '22004';
  end if;

  -- An attendee id (check-in app) or an application id (console).
  select application_id into v_app_id from public.attendees
   where event_id = p_event_id and id = p_person_id;
  v_app_id := coalesce(v_app_id, p_person_id);

  select * into a from public.applications where id = v_app_id and event_id = p_event_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if a.status is distinct from 'accepted' then
    return jsonb_build_object('status', 'not_accepted', 'application_status', a.status);
  end if;
  if a.user_id is null then
    return jsonb_build_object('status', 'no_account');
  end if;

  select code, name into v_code, v_name from public.attendees where application_id = a.id;

  insert into public.waivers (event_id, user_id, signed_at, envelope_id, source, recorded_by, note)
  values (p_event_id, a.user_id, now(), null, 'manual', auth.uid(), v_note)
  on conflict (event_id, user_id) do nothing
  returning * into w;

  if found then
    return jsonb_build_object('status', 'marked', 'signed_at', w.signed_at, 'code', v_code, 'name', v_name);
  end if;
  select * into w from public.waivers where event_id = p_event_id and user_id = a.user_id;
  return jsonb_build_object('status', 'already_on_file', 'signed_at', w.signed_at, 'source', w.source, 'code', v_code, 'name', v_name);
end $$;

revoke all on function public.mark_waiver_seen(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_waiver_seen(uuid, uuid, text) to authenticated, service_role;
