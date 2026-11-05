-- PowerForm waivers: CSV import and the desk's manual mark
-- (migration *_waiver_powerform.sql). Run with supabase/tests/run.sh.
-- Each check prints PASS or raises FAIL.
\set ON_ERROR_STOP on

insert into public.events (id, name, code, applications_open) values
  ('00000000-0000-0000-0000-0000000000b1', 'DataHacks 2027 Beta', 'DH27BETA', true),
  ('00000000-0000-0000-0000-0000000000d7', 'DataHacks 2027', 'DH27', true);
insert into auth.users (id, email, email_confirmed_at) values
  ('33333333-0000-0000-0000-000000000001', 'hana@example.com', now()),
  ('33333333-0000-0000-0000-000000000002', 'org@example.com', now()),
  ('33333333-0000-0000-0000-000000000003', 'otherorg@example.com', now()),
  ('33333333-0000-0000-0000-000000000004', 'pending@example.com', now()),
  ('33333333-0000-0000-0000-000000000005', 'mentor@example.com', now()),
  ('33333333-0000-0000-0000-000000000006', 'elsewhere@example.com', now()),
  ('33333333-0000-0000-0000-000000000007', 'hugo@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users where email like '%@example.com';
insert into public.event_roles (event_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', '33333333-0000-0000-0000-000000000002', 'organizer'),
  ('00000000-0000-0000-0000-0000000000d7', '33333333-0000-0000-0000-000000000003', 'organizer');

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
-- Runs a query as a request and returns its single text result (or the error).
create function pg_temp.q_as(p_sub uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql into v;
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

\set hana '''33333333-0000-0000-0000-000000000001'''
\set org '''33333333-0000-0000-0000-000000000002'''
\set otherorg '''33333333-0000-0000-0000-000000000003'''
\set pending '''33333333-0000-0000-0000-000000000004'''
\set mentor '''33333333-0000-0000-0000-000000000005'''
\set elsewhere '''33333333-0000-0000-0000-000000000006'''
\set hugo '''33333333-0000-0000-0000-000000000007'''
\set beta '00000000-0000-0000-0000-0000000000b1'
\set dh27 '00000000-0000-0000-0000-0000000000d7'

-- Applications: accepted hackers Hana and Hugo, an accepted mentor, a pending
-- hacker, someone accepted at another event, and an accepted application with
-- no portal account.
insert into applications (id, user_id, event_id, applicant_type, status, first_name, last_name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', :hana, :'beta', 'hacker', 'submitted', 'Hana', 'Hacker', 'hana@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000007', :hugo, :'beta', 'hacker', 'submitted', 'Hugo', 'Hacker', 'hugo@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000004', :pending, :'beta', 'hacker', 'submitted', 'Pat', 'Pending', 'pending@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000006', :elsewhere, :'dh27', 'hacker', 'submitted', 'Eli', 'Elsewhere', 'elsewhere@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000008', null, :'beta', 'hacker', 'submitted', 'Nora', 'NoAccount', 'nora@example.org');
insert into applications (id, user_id, event_id, applicant_type, status, email, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring, first_name, last_name)
  values ('aaaaaaaa-0000-0000-0000-000000000005', :mentor, :'beta', 'mentor', 'submitted', 'mentor@example.com', 'O', 'R', 'https://l', 'none', true, 'Mo', 'Mentor');
update applications set status = 'accepted' where id in (
  'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000008');
select pg_temp.expect('fixture: the no-account application has no user',
  (select coalesce(user_id::text, 'null') from applications where id = 'aaaaaaaa-0000-0000-0000-000000000008'), 'null');

-- 0. Columns: existing writes default to the embedded source.
select pg_temp.expect('edge function (service role) insert still works and defaults to docusign_embedded',
  pg_temp.as_req(null, 'service_role', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), 'env-embedded')$q$, :'dh27', :elsewhere)),
  'ok');
select pg_temp.expect('source defaults', (select source from waivers where user_id = :elsewhere), 'docusign_embedded');
select pg_temp.expect('unknown source refused',
  pg_temp.as_req(null, 'service_role', format($q$update waivers set source = 'self' where user_id = %L$q$, :elsewhere)),
  '23514: %');
delete from waivers where user_id = :elsewhere;

-- 1. Who can call them.
\set import_hana '''[{"application_id":"aaaaaaaa-0000-0000-0000-000000000001","envelope_id":"0f1e2d3c-aaaa-bbbb-cccc-1234567890ab","signed_at":"2026-11-04T10:00:00-08:00"}]'''
select pg_temp.expect('an applicant cannot import',
  pg_temp.q_as(:hana, 'authenticated', format($q$select record_waivers_import(%L, %L)::text$q$, :'beta', :import_hana)), '42501: Not authorized');
select pg_temp.expect('another event''s organizer cannot import into this one',
  pg_temp.q_as(:otherorg, 'authenticated', format($q$select record_waivers_import(%L, %L)::text$q$, :'beta', :import_hana)), '42501: Not authorized');
select pg_temp.expect('anon cannot import',
  pg_temp.q_as(null, 'anon', format($q$select record_waivers_import(%L, %L)::text$q$, :'beta', :import_hana)), '42501: permission denied%');
select pg_temp.expect('an applicant cannot mark',
  pg_temp.q_as(:hana, 'authenticated', format($q$select mark_waiver_seen(%L, %L)::text$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000001')), '42501: Not authorized');
select pg_temp.expect('another event''s organizer cannot mark',
  pg_temp.q_as(:otherorg, 'authenticated', format($q$select mark_waiver_seen(%L, %L)::text$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000001')), '42501: Not authorized');
select pg_temp.expect('anon cannot mark',
  pg_temp.q_as(null, 'anon', format($q$select mark_waiver_seen(%L, %L)::text$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000001')), '42501: permission denied%');
select pg_temp.expect('nothing was written by the refused calls', (select count(*)::text from waivers), '0');

-- 2. Import: only this event's accepted people with an account.
select pg_temp.expect('organizer import: 1 recorded, 6 skipped with reasons',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'recorded' || ' ' || (r->>'already_on_file') || ' ' || (r->>'skipped') || ' ' ||
      (select string_agg(x->>'reason', ',' order by x->>'reason') from jsonb_array_elements(r->'skipped_rows') x)
    from record_waivers_import(%L, %L::jsonb) r$q$, :'beta', $j$[
      {"application_id":"aaaaaaaa-0000-0000-0000-000000000001","envelope_id":"0f1e2d3c-aaaa-bbbb-cccc-1234567890ab","signed_at":"2026-11-04T10:00:00-08:00"},
      {"application_id":"aaaaaaaa-0000-0000-0000-000000000004","envelope_id":"env-pending","signed_at":"2026-11-04T10:00:00-08:00"},
      {"application_id":"aaaaaaaa-0000-0000-0000-000000000006","envelope_id":"env-elsewhere","signed_at":"2026-11-04T10:00:00-08:00"},
      {"application_id":"aaaaaaaa-0000-0000-0000-000000000008","envelope_id":"env-noaccount"},
      {"application_id":"not-a-uuid","envelope_id":"env-x"},
      {"application_id":"aaaaaaaa-0000-0000-0000-000000000099","envelope_id":"env-unknown"},
      {"application_id":"aaaaaaaa-0000-0000-0000-000000000007","envelope_id":"<script>"}
    ]$j$)),
  '1 0 6 bad_envelope,bad_id,no_account,not_accepted,not_in_event,not_in_event');
select pg_temp.expect('imported row: source, envelope, CSV time, recorded_by',
  (select source || ' ' || envelope_id || ' ' || (signed_at = '2026-11-04 10:00-08')::text || ' ' || (recorded_by = :org)::text from waivers where user_id = :hana),
  'docusign_import 0f1e2d3c-aaaa-bbbb-cccc-1234567890ab true true');
select pg_temp.expect('roster copy follows the import',
  (select (waiver_signed_at = '2026-11-04 10:00-08')::text from attendees where user_id = :hana), 'true');
select pg_temp.expect('nobody outside the event or not accepted got a waiver',
  (select count(*)::text from waivers), '1');

-- 3. Idempotent: the first signature stays.
select pg_temp.expect('importing the same person again: 0 recorded, 1 already on file',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'recorded' || ' ' || (r->>'already_on_file') from record_waivers_import(%L, %L::jsonb) r$q$, :'beta',
    '[{"application_id":"aaaaaaaa-0000-0000-0000-000000000001","envelope_id":"another-envelope","signed_at":"2026-11-05T10:00:00-08:00"}]')),
  '0 1');
select pg_temp.expect('first envelope and time kept',
  (select envelope_id || ' ' || (signed_at = '2026-11-04 10:00-08')::text from waivers where user_id = :hana),
  '0f1e2d3c-aaaa-bbbb-cccc-1234567890ab true');
select pg_temp.expect('the same person twice in one file counts once',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'recorded' || ' ' || (r->>'already_on_file') from record_waivers_import(%L, %L::jsonb) r$q$, :'beta',
    '[{"application_id":"aaaaaaaa-0000-0000-0000-000000000007","envelope_id":"env-h1","signed_at":"2099-01-01T00:00:00Z"},{"application_id":"aaaaaaaa-0000-0000-0000-000000000007","envelope_id":"env-h2"}]')),
  '1 1');
select pg_temp.expect('a completion time in the future is clamped to now',
  (select (signed_at <= now())::text || ' ' || envelope_id from waivers where user_id = :hugo), 'true env-h1');
select pg_temp.expect('rows must be an array',
  pg_temp.q_as(:org, 'authenticated', format($q$select record_waivers_import(%L, '{}'::jsonb)::text$q$, :'beta')), '22023: %');

-- 4. Manual mark at the desk.
delete from waivers where user_id = :hugo;
select pg_temp.expect('no person: refuses without writing (the check-in app''s feature probe)',
  pg_temp.q_as(:org, 'authenticated', format($q$select mark_waiver_seen(%L, null)::text$q$, :'beta')), '22004: %');
select pg_temp.expect('mark by attendee id (check-in app)',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' || ' ' || (r->>'code' is not null)::text || ' ' || (r->>'name') from mark_waiver_seen(%L, (select id from attendees where user_id = %L), ' Showed the DocuSign email ') r$q$, :'beta', :mentor)),
  'marked true Mo Mentor');
select pg_temp.expect('manual row: source, no envelope, note trimmed, recorded_by',
  (select source || ' ' || coalesce(envelope_id, 'null') || ' [' || note || '] ' || (recorded_by = :org)::text from waivers where user_id = :mentor),
  'manual null [Showed the DocuSign email] true');
select pg_temp.expect('roster copy follows the mark',
  (select (waiver_signed_at is not null)::text from attendees where user_id = :mentor), 'true');
select pg_temp.expect('marking again keeps the first one',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' || ' ' || (r->>'source') from mark_waiver_seen(%L, %L) r$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000005')),
  'already_on_file manual');
select pg_temp.expect('marking someone imported says already on file',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' || ' ' || (r->>'source') from mark_waiver_seen(%L, %L) r$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000001')),
  'already_on_file docusign_import');
select pg_temp.expect('mark by application id (console)',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' from mark_waiver_seen(%L, %L) r$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000007')),
  'marked');
select pg_temp.expect('a pending applicant can''t be marked',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' from mark_waiver_seen(%L, %L) r$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000004')),
  'not_accepted');
select pg_temp.expect('someone from another event isn''t found here',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' from mark_waiver_seen(%L, %L) r$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000006')),
  'not_found');
select id as elsewhere_attendee from attendees where user_id = :elsewhere \gset
select pg_temp.expect('another event''s attendee id isn''t found here either',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' from mark_waiver_seen(%L, %L) r$q$, :'beta', :'elsewhere_attendee')),
  'not_found');
select pg_temp.expect('no portal account: nothing to attach it to',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' from mark_waiver_seen(%L, %L) r$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000008')),
  'no_account');
delete from waivers where user_id = :hugo;
select pg_temp.expect('a long note is cut to 500 characters',
  pg_temp.q_as(:org, 'authenticated', format($q$select r->>'status' from mark_waiver_seen(%L, %L, repeat('x', 900)) r$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000007')),
  'marked');
select pg_temp.expect('... and stored as 500', (select char_length(note)::text from waivers where user_id = :hugo), '500');
select pg_temp.expect('pending and other-event people still have none',
  (select count(*)::text from waivers where user_id in (:pending, :elsewhere)), '0');

-- 5. Everything else stays service-role only.
select pg_temp.expect('organizer still cannot insert directly',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into waivers (event_id, user_id, signed_at, source) values (%L, %L, now(), 'manual')$q$, :'beta', :pending)),
  '42501: permission denied%');
select pg_temp.expect('organizer cannot update a waiver',
  pg_temp.as_req(:org, 'authenticated', $q$update waivers set note = 'x'$q$), '42501: permission denied%');
select pg_temp.expect('applicant cannot delete their waiver',
  pg_temp.as_req(:hana, 'authenticated', $q$delete from waivers$q$), '42501: permission denied%');
select pg_temp.expect('applicant still reads their own row only',
  pg_temp.q_as(:hana, 'authenticated', $q$select count(*)::text from waivers$q$), '1');

-- 6. Re-running the migration changes nothing.
set client_min_messages = warning;
\ir ../migrations/20261105180000_waiver_powerform.sql
set client_min_messages = notice;
select pg_temp.expect('re-run keeps rows and sources',
  (select string_agg(source, ',' order by source) from waivers), 'docusign_import,manual,manual');
select pg_temp.expect('re-run keeps the functions organizer-only',
  pg_temp.q_as(:hana, 'authenticated', format($q$select mark_waiver_seen(%L, %L)::text$q$, :'beta', 'aaaaaaaa-0000-0000-0000-000000000004')), '42501: Not authorized');
