-- Baseline: the shared DataHacks schema as it was live on 2026-10-22.
--
-- Captured from production (yrxjhrrphhbmqejresvy) with
--   pg_dump --schema-only --schema=public --no-owner --no-comments
-- It holds everything the application portal and the check-in system
-- (DS3-DataHacks-Check-in) had built by hand in the SQL editor until then:
-- events, event_roles, applications, attendees, checkins, teams, profiles,
-- organizer_invites, their triggers, functions, policies and grants. The four
-- hand-applied portal migrations it replaces are kept in supabase/archive/.
--
-- Grants: each object's grants are reset (the lines marked "-- reset") before
-- production's exact grants, because a
-- fresh project's default privileges would otherwise hand the API roles more
-- than production gives them.
--
-- From here on, every schema change is a new file in supabase/migrations,
-- applied by GitHub Actions: staging first, then production.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;



-- Name: app_role; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.app_role AS ENUM (
    'hacker',
    'mentor',
    'judge',
    'organizer'
);


-- Name: user_role; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.user_role AS ENUM (
    'hacker',
    'judge',
    'mentor'
);


-- Name: add_organizer(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.add_organizer(p_event_id uuid, p_email text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user  uuid;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That doesn''t look like an email address.';
  end if;

  insert into public.organizer_invites (event_id, email, invited_by)
  values (p_event_id, v_email, auth.uid())
  on conflict (event_id, email) do nothing;

  select u.id into v_user from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = v_email and u.email_confirmed_at is not null
  limit 1;
  if v_user is null then
    return 'invited';
  end if;

  insert into public.event_roles (event_id, user_id, role)
  values (p_event_id, v_user, 'organizer')
  on conflict do nothing;
  return 'added';
end;
$_$;


-- Name: applications_guard_decision(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.applications_guard_decision() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and not public.is_event_staff(old.event_id) then
    new.decision             := old.decision;
    new.decision_released_at := old.decision_released_at;
    new.decision_emailed_at  := old.decision_emailed_at;
  end if;
  return new;
end;
$$;


-- Name: applications_no_decision_on_insert(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.applications_no_decision_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and not public.is_event_staff(new.event_id) then
    new.decision             := null;
    new.decision_released_at := null;
    new.decision_emailed_at  := null;
  end if;
  return new;
end;
$$;


-- Name: check_in_attendee(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.check_in_attendee(p_event_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_inserted int;
  v_at timestamptz;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.event_roles
                 where event_id = p_event_id and user_id = p_user_id
                   and role in ('hacker', 'mentor', 'judge')) then
    raise exception 'Not accepted for this event';
  end if;

  insert into public.checkins (event_id, user_id, checked_in_by)
  values (p_event_id, p_user_id, auth.uid())
  on conflict (event_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;

  select checked_in_at into v_at from public.checkins
  where event_id = p_event_id and user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'already_checked_in', v_inserted = 0,
    'checked_in_at', v_at
  );
end $$;


-- Name: check_in_by_code(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.check_in_by_code(p_event_id uuid, p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      'team', r.team, 'checked_in_at', r.checked_in_at);
  end if;

  select * into r from public.attendees
   where event_id = p_event_id and code = v_code;

  if found then
    return jsonb_build_object(
      'status', 'dupe', 'code', r.code, 'name', r.name, 'roles', to_jsonb(r.roles),
      'team', r.team, 'checked_in_at', r.checked_in_at);
  end if;

  return jsonb_build_object('status', 'unknown', 'code', v_code);
end $$;


-- Name: grant_invited_organizer(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.grant_invited_organizer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.event_roles (event_id, user_id, role)
  select i.event_id, new.id, 'organizer'
  from public.organizer_invites i
  join auth.users u on u.id = new.id
  where i.email = lower(u.email) and u.email_confirmed_at is not null
  on conflict do nothing;
  return new;
end;
$$;


-- Name: is_event_staff(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.is_event_staff(eid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.event_roles er
    where er.event_id = eid
      and er.user_id = auth.uid()
      and er.role = 'organizer'
  );
$$;


-- Name: link_staff_applications(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.link_staff_applications() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text;
begin
  select u.email into v_email
  from auth.users u
  where u.id = new.id and u.email_confirmed_at is not null;

  if v_email is null then
    return new;
  end if;

  update public.applications a
     set user_id = new.id
   where a.user_id is null
     and a.applicant_type <> 'hacker'
     and lower(a.email) = lower(v_email)
     and not exists (select 1 from public.applications x
                     where x.user_id = new.id
                       and x.event_id is not distinct from a.event_id);

  insert into public.event_roles (event_id, user_id, role)
  select a.event_id, new.id, r::public.app_role
  from public.applications a
  cross join lateral unnest(
    case a.applicant_type
      when 'mentor' then array['mentor']
      when 'judge'  then array['judge']
      when 'hybrid' then array['mentor','judge']
    end
  ) as r
  where a.user_id = new.id and a.status = 'accepted'
    and a.applicant_type <> 'hacker' and a.event_id is not null
  on conflict do nothing;

  return new;
end $$;


-- Name: list_organizers(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.list_organizers(p_event_id uuid) RETURNS TABLE(email text, status text, added_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  return query
  select lower(u.email)::text, 'active'::text, er.created_at
  from public.event_roles er join auth.users u on u.id = er.user_id
  where er.event_id = p_event_id and er.role = 'organizer'
  union all
  select i.email, 'invited'::text, i.created_at
  from public.organizer_invites i
  where i.event_id = p_event_id
    and not exists (
      select 1 from public.event_roles er join auth.users u on u.id = er.user_id
      where er.event_id = p_event_id and er.role = 'organizer' and lower(u.email) = i.email
    )
  order by 1;
end;
$$;


-- Name: mentor_roster(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.mentor_roster(p_event_id uuid) RETURNS TABLE(first_name text, last_name text, bio text, checked_in boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (
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


-- Name: next_attendee_code(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.next_attendee_code(p_event_id uuid, p_roles text[]) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_prefix text;
  v_letter text;
  v_n      int;
begin
  select upper(code) into v_prefix from public.events where id = p_event_id;
  if v_prefix is null then
    raise exception 'Event % has no code. Run: update public.events set code = ''DH26'' where id = ''%'';',
      p_event_id, p_event_id;
  end if;

  v_letter := case
    when p_roles @> array['mentor','judge']::text[] then 'B'
    when 'judge'  = any (p_roles) then 'J'
    when 'mentor' = any (p_roles) then 'M'
    else 'H'
  end;

  select coalesce(max((substring(code from '(\d+)$'))::int), 0) + 1
    into v_n
    from public.attendees
   where event_id = p_event_id
     and code like v_prefix || '-' || v_letter || '%';

  return v_prefix || '-' || v_letter || lpad(v_n::text, 3, '0');
end $_$;


-- Name: profiles_email_from_login(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.profiles_email_from_login() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  new.email := coalesce((select u.email from auth.users u where u.id = new.id), new.email);
  -- From the website (a signed-in request), role is never taken from the request.
  -- Organizers editing in the dashboard have no auth.uid() and are left alone.
  if auth.uid() is not null then
    new.role := case when tg_op = 'UPDATE' then old.role else 'hacker' end;
  end if;
  return new;
end;
$$;


-- Name: promote_accepted(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.promote_accepted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := new.user_id;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted'
     and new.event_id is not null then

    if v_user is null and new.email is not null then
      select p.id into v_user
      from public.profiles p
      join auth.users u on u.id = p.id
      where lower(u.email) = lower(new.email)
        and u.email_confirmed_at is not null
      limit 1;

      if v_user is not null
         and not exists (select 1 from public.applications x
                         where x.user_id = v_user
                           and x.event_id = new.event_id) then
        update public.applications set user_id = v_user where id = new.id;
      end if;
    end if;

    if v_user is not null then
      insert into public.event_roles (event_id, user_id, role)
      select new.event_id, v_user, r::public.app_role
      from unnest(
        case new.applicant_type
          when 'mentor' then array['mentor']
          when 'judge'  then array['judge']
          when 'hybrid' then array['mentor','judge']
          else array['hacker']
        end
      ) as r
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;


-- Name: release_decisions(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.release_decisions(p_event_id uuid) RETURNS TABLE(application_id uuid, email text, first_name text, applicant_type text, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;

  return query
  with released as (
    update public.applications a
    set status = a.decision, decision_released_at = now()
    where a.event_id = p_event_id
      and a.decision is not null
      and a.status is distinct from a.decision
    returning a.id, a.email, a.first_name, a.applicant_type, a.status, a.user_id
  )
  select r.id, coalesce(nullif(btrim(r.email), ''), p.email), r.first_name, r.applicant_type, r.status
  from released r
  left join public.profiles p on p.id = r.user_id;
end;
$$;


-- Name: remove_organizer(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.remove_organizer(p_event_id uuid, p_email text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'You can''t remove yourself. Ask another organizer.';
  end if;

  delete from public.organizer_invites where event_id = p_event_id and email = v_email;
  delete from public.event_roles er
  using auth.users u
  where er.user_id = u.id and er.event_id = p_event_id and er.role = 'organizer' and lower(u.email) = v_email;
end;
$$;


-- Name: trg_sync_attendee(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.trg_sync_attendee() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.upsert_attendee(new.id);
  return null;
end $$;


-- Name: undo_check_in(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.undo_check_in(p_event_id uuid, p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  r      public.attendees%rowtype;
begin
  if not public.is_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;

  update public.attendees
     set checked_in_at = null,
         checked_in_by = null
   where event_id = p_event_id
     and code = v_code
     and checked_in_at is not null
  returning * into r;

  if found then
    return jsonb_build_object('status', 'ok', 'code', r.code, 'name', r.name);
  end if;
  return jsonb_build_object('status', 'not_checked_in', 'code', v_code);
end $$;


-- Name: upsert_attendee(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.upsert_attendee(p_application_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  a        public.applications%rowtype;
  p        public.profiles%rowtype;
  v_roles  text[];
  v_email  text;
  v_name   text;
  v_code   text;
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

  insert into public.attendees (event_id, application_id, user_id, code, name, email, roles)
  values (a.event_id, a.id, a.user_id, v_code, v_name, v_email, v_roles)
  on conflict (application_id) do update
    set user_id    = excluded.user_id,
        name       = excluded.name,
        email      = excluded.email,
        roles      = excluded.roles,
        emailed_at = case when public.attendees.email is distinct from excluded.email
                          then null else public.attendees.emailed_at end;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

-- Name: applications; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    first_name text,
    last_name text,
    gender text,
    race_ethnicity text,
    birthdate date,
    country_of_residence text,
    city_of_residence text,
    level_of_study text,
    school text,
    major text,
    graduation_year text,
    hackathon_experience text,
    attended_before boolean,
    attended_events text[],
    linkedin_url text,
    devpost_url text,
    resume_path text,
    essay_proudest_project text,
    essay_unique_thing text,
    essay_goal text,
    funniest_joke text,
    lifetime_goal text,
    wants_travel_stipend boolean DEFAULT false,
    travel_stipend_reason text,
    travel_region text,
    heard_about text[],
    agreed_to_terms boolean DEFAULT false NOT NULL,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    event_id uuid,
    applicant_type text DEFAULT 'hacker'::text NOT NULL,
    email text,
    organization text,
    role_title text,
    resume_url text,
    ucsd_affiliation text,
    judging_track text,
    bio text,
    acknowledged_in_person_judging boolean DEFAULT false NOT NULL,
    acknowledged_onsite_mentoring boolean DEFAULT false NOT NULL,
    acknowledged_both_priority boolean DEFAULT false NOT NULL,
    phone text,
    decision text,
    decision_released_at timestamp with time zone,
    decision_emailed_at timestamp with time zone,
    github_url text,
    travel_method text,
    travel_distance text,
    CONSTRAINT applications_applicant_type_check CHECK ((applicant_type = ANY (ARRAY['hacker'::text, 'mentor'::text, 'judge'::text, 'hybrid'::text]))),
    CONSTRAINT applications_decision_check CHECK (((decision IS NULL) OR (decision = ANY (ARRAY['accepted'::text, 'waitlisted'::text, 'rejected'::text])))),
    CONSTRAINT applications_judging_track_check CHECK (((judging_track IS NULL) OR (judging_track = ANY (ARRAY['social_good_wellbeing'::text, 'healthcare_health_tech'::text, 'defense_cybersecurity'::text, 'fintech_econ_finance'::text, 'entertainment'::text])))),
    CONSTRAINT applications_staff_fields_check CHECK (((applicant_type = 'hacker'::text) OR ((email IS NOT NULL) AND (organization IS NOT NULL) AND (role_title IS NOT NULL) AND (linkedin_url IS NOT NULL) AND (ucsd_affiliation IS NOT NULL) AND ((applicant_type = 'mentor'::text) OR ((judging_track IS NOT NULL) AND acknowledged_in_person_judging)) AND ((applicant_type = 'judge'::text) OR (((bio IS NULL) OR (char_length(bio) >= 50)) AND acknowledged_onsite_mentoring))))),
    CONSTRAINT applications_ucsd_affiliation_check CHECK (((ucsd_affiliation IS NULL) OR (ucsd_affiliation = ANY (ARRAY['student'::text, 'alumni'::text, 'faculty'::text, 'none'::text]))))
);


-- Name: attendees; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    application_id uuid,
    user_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    email text,
    roles text[] NOT NULL,
    team text,
    emailed_at timestamp with time zone,
    checked_in_at timestamp with time zone,
    checked_in_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendees_roles_check CHECK (((cardinality(roles) > 0) AND (roles <@ ARRAY['hacker'::text, 'mentor'::text, 'judge'::text])))
);


-- Name: checkins; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.checkins (
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_in_by uuid
);


-- Name: event_roles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.event_roles (
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: events; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    code text,
    CONSTRAINT events_code_format CHECK (((code IS NULL) OR (code ~ '^[A-Za-z0-9]{2,10}$'::text)))
);


-- Name: organizer_invites; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.organizer_invites (
    event_id uuid NOT NULL,
    email text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organizer_invites_email_check CHECK (((email = lower(btrim(email))) AND (email ~~ '%_@_%'::text)))
);


-- Name: profiles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role public.user_role DEFAULT 'hacker'::public.user_role NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    first_name text,
    last_name text
);


-- Name: team_members; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.team_members (
    team_id uuid NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'hacker'::public.app_role NOT NULL,
    CONSTRAINT team_members_role_check CHECK ((role = 'hacker'::public.app_role))
);


-- Name: teams; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    table_number text
);


-- Name: v_checkin_list; Type: VIEW; Schema: public; Owner: -

CREATE VIEW public.v_checkin_list WITH (security_invoker='true') AS
 SELECT er.event_id,
    er.user_id,
    p.first_name,
    p.last_name,
    p.email,
    array_agg((er.role)::text ORDER BY (er.role)::text) AS roles,
    (ci.user_id IS NOT NULL) AS checked_in,
    ci.checked_in_at
   FROM ((public.event_roles er
     JOIN public.profiles p ON ((p.id = er.user_id)))
     LEFT JOIN public.checkins ci ON (((ci.event_id = er.event_id) AND (ci.user_id = er.user_id))))
  WHERE (er.role = ANY (ARRAY['hacker'::public.app_role, 'mentor'::public.app_role, 'judge'::public.app_role]))
  GROUP BY er.event_id, er.user_id, p.first_name, p.last_name, p.email, ci.user_id, ci.checked_in_at;


-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


-- Name: applications applications_user_event_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_event_key UNIQUE (user_id, event_id);


-- Name: attendees attendees_application_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_application_id_key UNIQUE (application_id);


-- Name: attendees attendees_event_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_event_code_key UNIQUE (event_id, code);


-- Name: attendees attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_pkey PRIMARY KEY (id);


-- Name: checkins checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_pkey PRIMARY KEY (event_id, user_id);


-- Name: event_roles event_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.event_roles
    ADD CONSTRAINT event_roles_pkey PRIMARY KEY (event_id, user_id, role);


-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


-- Name: organizer_invites organizer_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.organizer_invites
    ADD CONSTRAINT organizer_invites_pkey PRIMARY KEY (event_id, email);


-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (event_id, user_id);


-- Name: teams teams_event_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_event_id_name_key UNIQUE (event_id, name);


-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


-- Name: applications_staff_email_event_key; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX applications_staff_email_event_key ON public.applications USING btree (event_id, lower(email)) WHERE ((applicant_type <> 'hacker'::text) AND (email IS NOT NULL));


-- Name: attendees_event_checkin_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX attendees_event_checkin_idx ON public.attendees USING btree (event_id, checked_in_at);


-- Name: event_roles_event_role_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX event_roles_event_role_idx ON public.event_roles USING btree (event_id, role);


-- Name: event_roles_user_id_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX event_roles_user_id_idx ON public.event_roles USING btree (user_id);


-- Name: events_code_key; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX events_code_key ON public.events USING btree (upper(code)) WHERE (code IS NOT NULL);


-- Name: applications applications_guard_decision; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER applications_guard_decision BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_guard_decision();


-- Name: applications applications_no_decision_on_insert; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER applications_no_decision_on_insert BEFORE INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_no_decision_on_insert();


-- Name: profiles grant_invited_organizer; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER grant_invited_organizer AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.grant_invited_organizer();


-- Name: profiles link_staff_applications; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER link_staff_applications AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.link_staff_applications();


-- Name: applications on_application_accepted; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER on_application_accepted AFTER UPDATE OF status ON public.applications FOR EACH ROW EXECUTE FUNCTION public.promote_accepted();


-- Name: profiles profiles_email_from_login; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER profiles_email_from_login BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_email_from_login();


-- Name: applications sync_attendee; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER sync_attendee AFTER INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.trg_sync_attendee();


-- Name: applications applications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- Name: attendees attendees_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


-- Name: attendees attendees_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- Name: attendees attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


-- Name: attendees attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- Name: checkins checkins_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id);


-- Name: checkins checkins_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


-- Name: checkins checkins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- Name: event_roles event_roles_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.event_roles
    ADD CONSTRAINT event_roles_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


-- Name: event_roles event_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.event_roles
    ADD CONSTRAINT event_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- Name: organizer_invites organizer_invites_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.organizer_invites
    ADD CONSTRAINT organizer_invites_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


-- Name: organizer_invites organizer_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.organizer_invites
    ADD CONSTRAINT organizer_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Name: team_members team_members_event_id_user_id_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_event_id_user_id_role_fkey FOREIGN KEY (event_id, user_id, role) REFERENCES public.event_roles(event_id, user_id, role) ON DELETE CASCADE;


-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


-- Name: teams teams_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Name: applications applications staff read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "applications staff read" ON public.applications FOR SELECT TO authenticated USING (public.is_event_staff(event_id));


-- Name: applications applications staff update; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "applications staff update" ON public.applications FOR UPDATE TO authenticated USING (public.is_event_staff(event_id)) WITH CHECK (public.is_event_staff(event_id));


-- Name: applications applications_insert_own; Type: POLICY; Schema: public; Owner: -

CREATE POLICY applications_insert_own ON public.applications FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (applicant_type = ANY (ARRAY['hacker'::text, 'mentor'::text, 'judge'::text, 'hybrid'::text])) AND (status = ANY (ARRAY['draft'::text, 'submitted'::text]))));


-- Name: applications applications_select_own; Type: POLICY; Schema: public; Owner: -

CREATE POLICY applications_select_own ON public.applications FOR SELECT USING ((auth.uid() = user_id));


-- Name: applications applications_update_own_draft; Type: POLICY; Schema: public; Owner: -

CREATE POLICY applications_update_own_draft ON public.applications FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (status = 'draft'::text))) WITH CHECK (((auth.uid() = user_id) AND (status = ANY (ARRAY['draft'::text, 'submitted'::text]))));


-- Name: attendees; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

-- Name: attendees attendees staff read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "attendees staff read" ON public.attendees FOR SELECT TO authenticated USING (public.is_event_staff(event_id));


-- Name: checkins; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Name: checkins checkins self read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "checkins self read" ON public.checkins FOR SELECT TO authenticated USING ((user_id = auth.uid()));


-- Name: checkins checkins staff read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "checkins staff read" ON public.checkins FOR SELECT TO authenticated USING (public.is_event_staff(event_id));


-- Name: event_roles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;

-- Name: event_roles event_roles self read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "event_roles self read" ON public.event_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


-- Name: event_roles event_roles staff read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "event_roles staff read" ON public.event_roles FOR SELECT TO authenticated USING (public.is_event_staff(event_id));


-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Name: events events read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "events read" ON public.events FOR SELECT TO authenticated, anon USING (true);


-- Name: organizer_invites; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.organizer_invites ENABLE ROW LEVEL SECURITY;

-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Name: profiles profiles staff read; Type: POLICY; Schema: public; Owner: -

CREATE POLICY "profiles staff read" ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.event_roles er
  WHERE ((er.user_id = profiles.id) AND public.is_event_staff(er.event_id)))));


-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING ((auth.uid() = id));


-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id));


-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


-- Name: FUNCTION add_organizer(p_event_id uuid, p_email text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.add_organizer(p_event_id uuid, p_email text) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.add_organizer(p_event_id uuid, p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_organizer(p_event_id uuid, p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.add_organizer(p_event_id uuid, p_email text) TO service_role;


-- Name: FUNCTION applications_guard_decision(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.applications_guard_decision() FROM anon, authenticated, service_role; -- reset
GRANT ALL ON FUNCTION public.applications_guard_decision() TO anon;
GRANT ALL ON FUNCTION public.applications_guard_decision() TO authenticated;
GRANT ALL ON FUNCTION public.applications_guard_decision() TO service_role;


-- Name: FUNCTION applications_no_decision_on_insert(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.applications_no_decision_on_insert() FROM anon, authenticated, service_role; -- reset
GRANT ALL ON FUNCTION public.applications_no_decision_on_insert() TO anon;
GRANT ALL ON FUNCTION public.applications_no_decision_on_insert() TO authenticated;
GRANT ALL ON FUNCTION public.applications_no_decision_on_insert() TO service_role;


-- Name: FUNCTION check_in_attendee(p_event_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.check_in_attendee(p_event_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.check_in_attendee(p_event_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_in_attendee(p_event_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_in_attendee(p_event_id uuid, p_user_id uuid) TO service_role;


-- Name: FUNCTION check_in_by_code(p_event_id uuid, p_code text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.check_in_by_code(p_event_id uuid, p_code text) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.check_in_by_code(p_event_id uuid, p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_in_by_code(p_event_id uuid, p_code text) TO authenticated;
GRANT ALL ON FUNCTION public.check_in_by_code(p_event_id uuid, p_code text) TO service_role;


-- Name: FUNCTION grant_invited_organizer(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.grant_invited_organizer() FROM anon, authenticated, service_role; -- reset
GRANT ALL ON FUNCTION public.grant_invited_organizer() TO anon;
GRANT ALL ON FUNCTION public.grant_invited_organizer() TO authenticated;
GRANT ALL ON FUNCTION public.grant_invited_organizer() TO service_role;


-- Name: FUNCTION is_event_staff(eid uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.is_event_staff(eid uuid) FROM anon, authenticated, service_role; -- reset
GRANT ALL ON FUNCTION public.is_event_staff(eid uuid) TO anon;
GRANT ALL ON FUNCTION public.is_event_staff(eid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_event_staff(eid uuid) TO service_role;


-- Name: FUNCTION link_staff_applications(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.link_staff_applications() FROM anon, authenticated, service_role; -- reset
GRANT ALL ON FUNCTION public.link_staff_applications() TO anon;
GRANT ALL ON FUNCTION public.link_staff_applications() TO authenticated;
GRANT ALL ON FUNCTION public.link_staff_applications() TO service_role;


-- Name: FUNCTION list_organizers(p_event_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.list_organizers(p_event_id uuid) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.list_organizers(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_organizers(p_event_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.list_organizers(p_event_id uuid) TO service_role;


-- Name: FUNCTION mentor_roster(p_event_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.mentor_roster(p_event_id uuid) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.mentor_roster(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mentor_roster(p_event_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mentor_roster(p_event_id uuid) TO service_role;


-- Name: FUNCTION next_attendee_code(p_event_id uuid, p_roles text[]); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.next_attendee_code(p_event_id uuid, p_roles text[]) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.next_attendee_code(p_event_id uuid, p_roles text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.next_attendee_code(p_event_id uuid, p_roles text[]) TO service_role;


-- Name: FUNCTION profiles_email_from_login(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.profiles_email_from_login() FROM anon, authenticated, service_role; -- reset
GRANT ALL ON FUNCTION public.profiles_email_from_login() TO anon;
GRANT ALL ON FUNCTION public.profiles_email_from_login() TO authenticated;
GRANT ALL ON FUNCTION public.profiles_email_from_login() TO service_role;


-- Name: FUNCTION promote_accepted(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.promote_accepted() FROM anon, authenticated, service_role; -- reset
GRANT ALL ON FUNCTION public.promote_accepted() TO anon;
GRANT ALL ON FUNCTION public.promote_accepted() TO authenticated;
GRANT ALL ON FUNCTION public.promote_accepted() TO service_role;


-- Name: FUNCTION release_decisions(p_event_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.release_decisions(p_event_id uuid) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.release_decisions(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_decisions(p_event_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.release_decisions(p_event_id uuid) TO service_role;


-- Name: FUNCTION remove_organizer(p_event_id uuid, p_email text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.remove_organizer(p_event_id uuid, p_email text) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.remove_organizer(p_event_id uuid, p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_organizer(p_event_id uuid, p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.remove_organizer(p_event_id uuid, p_email text) TO service_role;


-- Name: FUNCTION trg_sync_attendee(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.trg_sync_attendee() FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.trg_sync_attendee() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trg_sync_attendee() TO service_role;


-- Name: FUNCTION undo_check_in(p_event_id uuid, p_code text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.undo_check_in(p_event_id uuid, p_code text) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.undo_check_in(p_event_id uuid, p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.undo_check_in(p_event_id uuid, p_code text) TO authenticated;
GRANT ALL ON FUNCTION public.undo_check_in(p_event_id uuid, p_code text) TO service_role;


-- Name: FUNCTION upsert_attendee(p_application_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.upsert_attendee(p_application_id uuid) FROM PUBLIC, anon, authenticated, service_role; -- reset
REVOKE ALL ON FUNCTION public.upsert_attendee(p_application_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.upsert_attendee(p_application_id uuid) TO service_role;


-- Name: TABLE applications; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.applications FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.applications TO anon;
GRANT ALL ON TABLE public.applications TO authenticated;
GRANT ALL ON TABLE public.applications TO service_role;


-- Name: TABLE attendees; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.attendees FROM anon, authenticated, service_role; -- reset
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.attendees TO authenticated;
GRANT ALL ON TABLE public.attendees TO service_role;


-- Name: TABLE checkins; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.checkins FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.checkins TO anon;
GRANT ALL ON TABLE public.checkins TO authenticated;
GRANT ALL ON TABLE public.checkins TO service_role;


-- Name: TABLE event_roles; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.event_roles FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.event_roles TO anon;
GRANT ALL ON TABLE public.event_roles TO authenticated;
GRANT ALL ON TABLE public.event_roles TO service_role;


-- Name: TABLE events; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.events FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


-- Name: TABLE organizer_invites; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.organizer_invites FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.organizer_invites TO anon;
GRANT ALL ON TABLE public.organizer_invites TO authenticated;
GRANT ALL ON TABLE public.organizer_invites TO service_role;


-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


-- Name: TABLE team_members; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.team_members FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.team_members TO anon;
GRANT ALL ON TABLE public.team_members TO authenticated;
GRANT ALL ON TABLE public.team_members TO service_role;


-- Name: TABLE teams; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.teams FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;


-- Name: TABLE v_checkin_list; Type: ACL; Schema: public; Owner: -

REVOKE ALL ON TABLE public.v_checkin_list FROM anon, authenticated, service_role; -- reset
GRANT ALL ON TABLE public.v_checkin_list TO anon;
GRANT ALL ON TABLE public.v_checkin_list TO authenticated;
GRANT ALL ON TABLE public.v_checkin_list TO service_role;














-- Resumes in storage: applicants read and upload their own; organizers read all.
-- (Storage tables belong to Supabase; only these policies are ours.)
drop policy if exists "organizers can read resumes" on storage.objects;
create policy "organizers can read resumes" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and exists (
    select 1 from public.event_roles er
    where er.user_id = auth.uid() and er.role = 'organizer'::public.app_role));
drop policy if exists "users can read own resume" on storage.objects;
create policy "users can read own resume" on storage.objects for select to public
  using (bucket_id = 'resumes' and (auth.uid())::text = (storage.foldername(name))[1]);
drop policy if exists "users can upload own resume" on storage.objects;
create policy "users can upload own resume" on storage.objects for insert to public
  with check (bucket_id = 'resumes' and (auth.uid())::text = (storage.foldername(name))[1]);

-- The check-in desk listens for roster changes over Realtime.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendees') then
    alter publication supabase_realtime add table public.attendees;
  end if;
end $$;

select pg_catalog.set_config('search_path', '"$user", public, extensions', false);
