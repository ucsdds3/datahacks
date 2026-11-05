-- Signed waivers on file (migration *_waivers_on_file.sql).
-- Run with supabase/tests/run.sh. Each check prints PASS or raises FAIL.
\set ON_ERROR_STOP on

insert into public.events (id, name, code, applications_open) values
  ('00000000-0000-0000-0000-0000000000b1', 'DataHacks 2027 Beta', 'DH27BETA', true),
  ('00000000-0000-0000-0000-0000000000d7', 'DataHacks 2027', 'DH27', false);
insert into auth.users (id, email, email_confirmed_at) values
  ('22222222-0000-0000-0000-000000000001', 'hacker@example.com', now()),
  ('22222222-0000-0000-0000-000000000002', 'org@example.com', now()),
  ('22222222-0000-0000-0000-000000000003', 'otherorg@example.com', now()),
  ('22222222-0000-0000-0000-000000000004', 'late@example.com', now()),
  ('22222222-0000-0000-0000-000000000005', 'nosy@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users where email like '%@example.com';
insert into public.event_roles (event_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', '22222222-0000-0000-0000-000000000002', 'organizer'),
  ('00000000-0000-0000-0000-0000000000d7', '22222222-0000-0000-0000-000000000003', 'organizer');

create function pg_temp.as_req(p_sub uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare v text := 'ok';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
  exception when others then v := sqlstate || ': ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
-- Runs a query as a request and returns its single text result.
create function pg_temp.q_as(p_sub uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
  perform set_config('role', p_role, true);
  execute p_sql into v;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create function pg_temp.expect(label text, got text, want text) returns void language plpgsql as $$
begin
  if got like want then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %: got [%], want [%]', label, got, want; end if;
end $$;

\set hacker '''22222222-0000-0000-0000-000000000001'''
\set org '''22222222-0000-0000-0000-000000000002'''
\set otherorg '''22222222-0000-0000-0000-000000000003'''
\set late '''22222222-0000-0000-0000-000000000004'''
\set nosy '''22222222-0000-0000-0000-000000000005'''
\set beta '00000000-0000-0000-0000-0000000000b1'

-- An accepted hacker on the roster, with no waiver yet.
insert into applications (user_id, event_id, applicant_type, status, first_name, last_name)
  values (:hacker, :'beta', 'hacker', 'submitted', 'Hana', 'Hacker');
update applications set status = 'accepted' where user_id = :hacker;
select pg_temp.expect('accepted hacker is on the roster without a waiver',
  (select coalesce(waiver_signed_at::text, 'null') from attendees where user_id = :hacker), 'null');

-- 1. Nobody signed in can write a waiver, including for themselves.
select pg_temp.expect('applicant cannot insert their own waiver',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), 'abc')$q$, :'beta', :hacker)),
  '42501: permission denied%');
select pg_temp.expect('organizer cannot insert a waiver',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), 'abc')$q$, :'beta', :hacker)),
  '42501: permission denied%');
select pg_temp.expect('anon cannot insert a waiver',
  pg_temp.as_req(null, 'anon', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), 'abc')$q$, :'beta', :hacker)),
  '42501: permission denied%');
select pg_temp.expect('applicant cannot set the roster copy',
  pg_temp.as_req(:hacker, 'authenticated', $q$update attendees set waiver_signed_at = now()$q$),
  '42501: permission denied%');
select pg_temp.expect('applicant cannot update their application into a signed state (no such column)',
  pg_temp.as_req(:hacker, 'authenticated', $q$update applications set waiver_signed_at = now()$q$),
  '42703: %');

-- 2. The edge function (service role) records it; the roster copy follows.
select pg_temp.expect('service role records a waiver',
  pg_temp.as_req(null, 'service_role', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, '2026-11-04 10:00-08', 'dc952e0b-f483-8e8c-8177-2957efaf17a0') on conflict (event_id, user_id) do nothing$q$, :'beta', :hacker)),
  'ok');
select pg_temp.expect('roster row shows the waiver',
  (select (waiver_signed_at = '2026-11-04 10:00-08')::text from attendees where user_id = :hacker), 'true');
select pg_temp.expect('recording again is a no-op (idempotent)',
  pg_temp.as_req(null, 'service_role', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), 'other-envelope') on conflict (event_id, user_id) do nothing$q$, :'beta', :hacker)),
  'ok');
select pg_temp.expect('first signature kept',
  (select envelope_id || ' ' || (signed_at = '2026-11-04 10:00-08')::text from waivers where user_id = :hacker),
  'dc952e0b-f483-8e8c-8177-2957efaf17a0 true');
select pg_temp.expect('envelope ids are plain GUID-ish strings',
  pg_temp.as_req(null, 'service_role', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), '<script>')$q$, :'beta', :late)),
  '23514: %');

-- 3. Who can read it.
select pg_temp.expect('applicant reads their own waiver',
  pg_temp.q_as(:hacker, 'authenticated', $q$select count(*)::text from waivers$q$), '1');
select pg_temp.expect('another applicant sees none',
  pg_temp.q_as(:nosy, 'authenticated', $q$select count(*)::text from waivers$q$), '0');
select pg_temp.expect('the event''s organizer reads it',
  pg_temp.q_as(:org, 'authenticated', $q$select count(*)::text from waivers$q$), '1');
select pg_temp.expect('an organizer of another event sees none',
  pg_temp.q_as(:otherorg, 'authenticated', $q$select count(*)::text from waivers$q$), '0');
select pg_temp.expect('anon reads nothing',
  pg_temp.as_req(null, 'anon', $q$select 1 from waivers$q$), '42501: permission denied%');
select pg_temp.expect('organizer sees it on the roster (check-in app query)',
  pg_temp.q_as(:org, 'authenticated', $q$select (waiver_signed_at is not null)::text from attendees where name = 'Hana Hacker'$q$), 'true');

-- 4. The scan card gets it from check_in_by_code (first scan and repeat).
select pg_temp.expect('check_in_by_code ok includes waiver_signed_at',
  pg_temp.q_as(:org, 'authenticated', format($q$select (r->>'status') || ' ' || ((r->>'waiver_signed_at')::timestamptz = '2026-11-04 10:00-08')::text from check_in_by_code(%L, (select code from attendees where name = 'Hana Hacker')) r$q$, :'beta')),
  'ok true');
select pg_temp.expect('check_in_by_code dupe includes waiver_signed_at',
  pg_temp.q_as(:org, 'authenticated', format($q$select (r->>'status') || ' ' || (r ? 'waiver_signed_at')::text from check_in_by_code(%L, (select code from attendees where name = 'Hana Hacker')) r$q$, :'beta')),
  'dupe true');

-- 5. A waiver recorded before acceptance shows once they're on the roster.
insert into applications (user_id, event_id, applicant_type, status, email, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring, first_name, last_name)
  values (:late, :'beta', 'mentor', 'submitted', 'late@example.com', 'O', 'R', 'https://l', 'none', true, 'Lee', 'Late');
insert into waivers (event_id, user_id, signed_at, envelope_id) values (:'beta', :late, now(), 'env-late');
select pg_temp.expect('not on the roster before acceptance', (select count(*)::text from attendees where user_id = :late), '0');
update applications set status = 'accepted' where user_id = :late;
select pg_temp.expect('accepted later: roster row has the waiver',
  (select (waiver_signed_at is not null)::text from attendees where user_id = :late), 'true');

-- 6. Editing an application keeps the roster copy; removing the waiver clears it.
update applications set first_name = 'Lee2' where user_id = :late;
select pg_temp.expect('application edit keeps waiver on roster',
  (select (waiver_signed_at is not null)::text from attendees where user_id = :late), 'true');
delete from waivers where user_id = :late;
select pg_temp.expect('deleting the waiver clears the roster copy',
  (select coalesce(waiver_signed_at::text, 'null') from attendees where user_id = :late), 'null');
select pg_temp.expect('check_in_by_code for someone unsigned has waiver_signed_at null',
  pg_temp.q_as(:org, 'authenticated', format($q$select (r->>'status') || ' ' || (r ? 'waiver_signed_at')::text || ' ' || coalesce(r->>'waiver_signed_at', 'null') from check_in_by_code(%L, (select code from attendees where user_id = %L)) r$q$, :'beta', :late)),
  'ok true null');

-- 7. Re-running the migration changes nothing.
set client_min_messages = warning;
\ir ../migrations/20261104200000_waivers_on_file.sql
set client_min_messages = notice;
select pg_temp.expect('re-run keeps waivers and the roster copy',
  (select count(*)::text || ' ' || bool_and(a.waiver_signed_at = w.signed_at)::text from waivers w join attendees a using (event_id, user_id)), '1 true');
select pg_temp.expect('re-run keeps writes closed to applicants',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), 'abc')$q$, :'beta', :late)),
  '42501: permission denied%');
