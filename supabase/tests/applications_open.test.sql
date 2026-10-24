-- The "applications open" switch (migration *_applications_open.sql).
-- Run with supabase/tests/run.sh. Each check prints PASS or raises FAIL.
\set ON_ERROR_STOP on

-- Events as they were before the migration (DH26 comes from baseline_data),
-- then the migration again (it is safe to re-run) so it sees DH27BETA.
insert into public.events (id, name, code) values
  ('00000000-0000-0000-0000-0000000000b1', 'DataHacks 2027 Beta', 'DH27BETA'),
  ('00000000-0000-0000-0000-0000000000d7', 'DataHacks 2027', 'DH27');
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-0000-0000-0000-000000000001', 'hacker@example.com', now()),
  ('11111111-0000-0000-0000-000000000002', 'org27@example.com', now()),
  ('11111111-0000-0000-0000-000000000003', 'orgbeta@example.com', now()),
  ('11111111-0000-0000-0000-000000000004', 'mentor@example.com', now()),
  ('11111111-0000-0000-0000-000000000005', 'hacker2@example.com', now());
-- The mentor has no profile yet: they sign up later in the test.
insert into public.profiles (id, email) select id, email from auth.users where email <> 'mentor@example.com';
insert into public.event_roles (event_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000d7', '11111111-0000-0000-0000-000000000002', 'organizer'),
  ('00000000-0000-0000-0000-0000000000b1', '11111111-0000-0000-0000-000000000003', 'organizer');
set client_min_messages = warning;
\ir ../migrations/20261024001139_applications_open.sql
set client_min_messages = notice;

-- Runs one statement as a request: sub = user id (null = no user), role = API role.
-- Returns 'ok' or 'SQLSTATE: message'.
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
create function pg_temp.expect(label text, got text, want text) returns void language plpgsql as $$
begin
  if got like want then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %: got [%], want [%]', label, got, want; end if;
end $$;

\set hacker '''11111111-0000-0000-0000-000000000001'''
\set org27 '''11111111-0000-0000-0000-000000000002'''
\set orgbeta '''11111111-0000-0000-0000-000000000003'''
\set hacker2 '''11111111-0000-0000-0000-000000000005'''
\set beta '00000000-0000-0000-0000-0000000000b1'
\set dh27 '00000000-0000-0000-0000-0000000000d7'
\set dh26 '96f5c446-76df-4001-948c-67c01a56ebcf'

-- 1. Defaults: only DH27BETA open.
select pg_temp.expect('DH27BETA open, DH27 and DH26 closed, open_at null',
  (select string_agg(code || '=' || applications_open || '/' || coalesce(applications_open_at::text, 'null'), ',' order by code) from events),
  'DH26=false/null,DH27=false/null,DH27BETA=true/null');
insert into events (name, code) values ('X', 'XTMP');
select pg_temp.expect('new event defaults closed', (select applications_open::text from events where code = 'XTMP'), 'false');
delete from events where code = 'XTMP';

-- 2. Applicant inserts.
select pg_temp.expect('applicant submits to DH27BETA (open)',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, submitted_at, first_name) values (%L, %L, 'hacker', 'submitted', now(), 'H')$q$, :hacker, :'beta')), 'ok');
select pg_temp.expect('applicant submits to DH27 (closed) is refused',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, submitted_at) values (%L, %L, 'hacker', 'submitted', now())$q$, :hacker, :'dh27')),
  '23514: Applications for DataHacks 2027 aren''t open right now.');
select pg_temp.expect('applicant draft to DH26 (closed) is refused',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status) values (%L, %L, 'hacker', 'draft')$q$, :hacker, :'dh26')),
  '23514: %aren''t open right now.');
update events set applications_open_at = '2026-11-03 09:00-08' where code = 'DH27';
select pg_temp.expect('closed with a future open date names the date',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status) values (%L, %L, 'hacker', 'submitted')$q$, :hacker, :'dh27')),
  '23514: Applications for DataHacks 2027 aren''t open yet. They open on November 3, 2026.');
update events set applications_open_at = now() - interval '1 day' where code = 'DH27';
select pg_temp.expect('a past open date alone does not open it',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status) values (%L, %L, 'hacker', 'submitted')$q$, :hacker, :'dh27')),
  '23514: %aren''t open right now.');

-- 3. Exemptions on insert.
select pg_temp.expect('organizer of DH27 can add an application while closed',
  pg_temp.as_req(:org27, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status) values (%L, %L, 'hacker', 'submitted')$q$, :org27, :'dh27')), 'ok');
select pg_temp.expect('organizer of another event (DH27BETA) is still an applicant for DH27',
  pg_temp.as_req(:orgbeta, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status) values (%L, %L, 'hacker', 'submitted')$q$, :orgbeta, :'dh27')), '23514: %aren''t open%');
select pg_temp.expect('service role (no user) inserts while closed',
  pg_temp.as_req(null, 'service_role', format($q$insert into applications (event_id, applicant_type, status, email, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring) values (%L, 'mentor', 'submitted', 'mentor@example.com', 'O', 'R', 'https://l', 'none', true)$q$, :'dh27')), 'ok');
-- SQL editor / migration (postgres, no claims): a plain insert while closed (fails the run if refused).
insert into applications (user_id, event_id, applicant_type, status) values (:hacker2, :'dh27', 'hacker', 'submitted');
select pg_temp.expect('SQL editor inserts while closed', (select count(*)::text from applications where user_id = :hacker2), '1');

-- 4. Drafts: create while open, submit while closed is refused; editing a draft is fine.
update events set applications_open = true where code = 'DH27';
select pg_temp.expect('applicant creates a draft while DH27 open',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status) values (%L, %L, 'hacker', 'draft')$q$, :hacker, :'dh27')), 'ok');
update events set applications_open = false where code = 'DH27';
select pg_temp.expect('applicant edits their draft while closed',
  pg_temp.as_req(:hacker, 'authenticated', format($q$update applications set first_name = 'Edited' where user_id = %L and event_id = %L$q$, :hacker, :'dh27')), 'ok');
select pg_temp.expect('applicant saves draft status unchanged while closed',
  pg_temp.as_req(:hacker, 'authenticated', format($q$update applications set status = 'draft' where user_id = %L and event_id = %L$q$, :hacker, :'dh27')), 'ok');
select pg_temp.expect('applicant submits their draft while closed is refused',
  pg_temp.as_req(:hacker, 'authenticated', format($q$update applications set status = 'submitted', submitted_at = now() where user_id = %L and event_id = %L$q$, :hacker, :'dh27')), '23514: %aren''t open%');
select pg_temp.expect('draft is still a draft', (select status from applications where user_id = :hacker and event_id = :'dh27'), 'draft');
update events set applications_open = true where code = 'DH27';
select pg_temp.expect('applicant submits their draft once open',
  pg_temp.as_req(:hacker, 'authenticated', format($q$update applications set status = 'submitted', submitted_at = now() where user_id = %L and event_id = %L$q$, :hacker, :'dh27')), 'ok');
update events set applications_open = false where code = 'DH27';

-- 5. Organizers' decisions and release keep working while closed.
select pg_temp.expect('organizer sets decisions while closed',
  pg_temp.as_req(:org27, 'authenticated', format($q$update applications set decision = 'accepted' where event_id = %L and user_id in (%L, %L)$q$, :'dh27', :hacker, :hacker2)), 'ok');
select pg_temp.expect('decisions saved', (select string_agg(coalesce(decision, 'null'), ',') from applications where event_id = :'dh27' and user_id in (:hacker, :hacker2)), 'accepted,accepted');
select pg_temp.expect('organizer changes a status by hand while closed',
  pg_temp.as_req(:org27, 'authenticated', format($q$update applications set status = 'waitlisted' where event_id = %L and user_id = %L$q$, :'dh27', :hacker2)), 'ok');
select pg_temp.expect('organizer releases decisions while closed',
  pg_temp.as_req(:org27, 'authenticated', format($q$select * from release_decisions(%L)$q$, :'dh27')), 'ok');
select pg_temp.expect('released: both accepted', (select string_agg(status, ',') from applications where event_id = :'dh27' and user_id in (:hacker, :hacker2)), 'accepted,accepted');
select pg_temp.expect('accepted hacker got the hacker role', (select string_agg(role::text, ',') from event_roles where event_id = :'dh27' and user_id = :hacker), 'hacker');
select pg_temp.expect('attendee rows made', (select count(*)::text from attendees where event_id = :'dh27'), '2');
select pg_temp.expect('organizer moves an acceptance back to submitted (exempt)',
  pg_temp.as_req(:org27, 'authenticated', format($q$update applications set status = 'submitted', decision = null where event_id = %L and user_id = %L$q$, :'dh27', :hacker2)), 'ok');

-- 6. Staff application linked to a new account when they sign up (closed event).
select pg_temp.expect('mentor signs up: their application links while closed',
  pg_temp.as_req('11111111-0000-0000-0000-000000000004', 'authenticated', $q$insert into profiles (id, email) values ('11111111-0000-0000-0000-000000000004', 'mentor@example.com')$q$), 'ok');
select pg_temp.expect('mentor application linked', (select user_id::text from applications where email = 'mentor@example.com'), '11111111-0000-0000-0000-000000000004');

-- 7. Applicant can't flip the switch.
select pg_temp.expect('applicant cannot open an event',
  pg_temp.as_req(:hacker, 'authenticated', $q$update events set applications_open = true where code = 'DH27'$q$), 'ok');
select pg_temp.expect('switch unchanged (RLS: no update policy)', (select applications_open::text from events where code = 'DH27'), 'false');
select pg_temp.expect('anon can read the switch',
  pg_temp.as_req(null, 'anon', $q$do $d$ begin perform applications_open, applications_open_at from events where code = 'DH27'; end $d$$q$), 'ok');
