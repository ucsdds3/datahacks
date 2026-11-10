-- Role isolation: what a hacker (any status), a mentor, a judge, a hybrid, an
-- applicant without a decision and someone with no application at all can
-- read and write through the API, compared with an organizer. Nothing here is
-- new behaviour; it pins down the boundary the portal relies on, so a future
-- policy, grant or function can't quietly open it. Run with supabase/tests/run.sh.
--
-- The portal decides which section someone sees from their own applications
-- row (type + status), and the database is the real boundary: every check
-- below is made with the API roles and JWT claims PostgREST would use.
\set ON_ERROR_STOP on

-- Runs one statement as a request with these JWT claims and API role.
-- Returns 'ok' or 'SQLSTATE: message'.
create function pg_temp.as_claims(p_claims jsonb, p_role text, p_sql text) returns text language plpgsql as $$
declare v text := 'ok';
begin
  perform set_config('request.jwt.claims', (p_claims || jsonb_build_object('role', p_role))::text, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
  exception when others then v := sqlstate || ': ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create function pg_temp.as_req(p_sub uuid, p_role text, p_sql text) returns text language sql as $$
  select pg_temp.as_claims(case when p_sub is null then '{}'::jsonb else jsonb_build_object('sub', p_sub) end, p_role, p_sql) $$;
-- Same, returning the statement's single value as text.
create function pg_temp.val_claims(p_claims jsonb, p_role text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', (p_claims || jsonb_build_object('role', p_role))::text, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql into v;
  exception when others then v := sqlstate || ': ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create function pg_temp.val_as(p_sub uuid, p_role text, p_sql text) returns text language sql as $$
  select pg_temp.val_claims(case when p_sub is null then '{}'::jsonb else jsonb_build_object('sub', p_sub) end, p_role, p_sql) $$;
create function pg_temp.expect(label text, got text, want text) returns void language plpgsql as $$
begin
  if got like want then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %: got [%], want [%]', label, got, want; end if;
end $$;
-- Nothing to see: either no rows come back or the read is refused outright.
create function pg_temp.sees_nothing(label text, p_sub uuid, p_sql text) returns void language plpgsql as $$
declare got text := pg_temp.val_as(p_sub, case when p_sub is null then 'anon' else 'authenticated' end, p_sql);
begin
  if got = '0' or got like '42501: %' then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %: got [%], want [0] or permission denied', label, got; end if;
end $$;

\set ev '00000000-0000-0000-0000-0000000e0001'
\set ev2 '00000000-0000-0000-0000-0000000e0002'

-- Who's who. hA/hP/hW/hR/hD: hackers accepted, pending, waitlisted, rejected,
-- still drafting. m/j/y: accepted mentor, judge, hybrid. mP: a mentor whose
-- application is still under review (with an acceptance staged but not
-- released). n: signed in, never applied. org: organizer of ev. org2:
-- organizer of another event only.
create temp table people (key text primary key, id uuid not null, email text not null);
grant select on people to anon, authenticated;
insert into people values
  ('hA', '55555555-0000-0000-0000-000000000001', 'ha@example.com'),
  ('hP', '55555555-0000-0000-0000-000000000002', 'hp@example.com'),
  ('hW', '55555555-0000-0000-0000-000000000003', 'hw@example.com'),
  ('hR', '55555555-0000-0000-0000-000000000004', 'hr@example.com'),
  ('hD', '55555555-0000-0000-0000-000000000005', 'hd@example.com'),
  ('m',  '55555555-0000-0000-0000-000000000006', 'm@example.com'),
  ('j',  '55555555-0000-0000-0000-000000000007', 'j@example.com'),
  ('y',  '55555555-0000-0000-0000-000000000008', 'y@example.com'),
  ('mP', '55555555-0000-0000-0000-000000000009', 'mp@example.com'),
  ('n',  '55555555-0000-0000-0000-00000000000a', 'n@example.com'),
  ('org','55555555-0000-0000-0000-00000000000b', 'org@example.com'),
  ('org2','55555555-0000-0000-0000-00000000000c', 'org2@example.com');
create function pg_temp.uid(p_key text) returns uuid language sql stable as $$ select id from people where key = p_key $$;
create function pg_temp.app(p_key text) returns uuid language sql stable as $$
  select a.id from public.applications a join people p on p.id = a.user_id where p.key = p_key $$;

insert into public.events (id, name, code, applications_open) values
  (:'ev', 'Isolation Test', 'RIT', true),
  (:'ev2', 'Other Event', 'RIO', true);
-- DO blocks can't see psql variables.
select set_config('my.ev', :'ev', false);
insert into auth.users (id, email, email_confirmed_at) select id, email, now() from people;
insert into public.profiles (id, email, first_name) select id, email, key from people;
insert into public.event_roles (event_id, user_id, role) values
  (:'ev', pg_temp.uid('org'), 'organizer'),
  (:'ev2', pg_temp.uid('org2'), 'organizer');

-- Applications, as the forms send them (the SQL editor here; the triggers
-- that matter still run).
insert into public.applications (user_id, event_id, applicant_type, status, first_name, last_name, school, resume_path, essay_goal, phone)
select pg_temp.uid(k), :'ev', 'hacker', case when k = 'hD' then 'draft' else 'submitted' end, k, 'Hacker', 'UC San Diego',
       pg_temp.uid(k) || '/resume.pdf', 'secret essay of ' || k, '(858) 555-0100'
  from unnest(array['hA', 'hP', 'hW', 'hR', 'hD']) as k;
insert into public.applications (user_id, event_id, applicant_type, status, first_name, last_name, email, organization, role_title,
                                 linkedin_url, ucsd_affiliation, judging_track, bio, acknowledged_in_person_judging, acknowledged_onsite_mentoring, phone)
select pg_temp.uid(k), :'ev', t, 'submitted', k, 'Staff', k || '@example.com', 'Org', 'Engineer',
       'https://linkedin.com/in/' || k, 'none',
       case when t in ('judge', 'hybrid') then 'entertainment' end,
       'bio of ' || k, t in ('judge', 'hybrid'), t in ('mentor', 'hybrid'), '(858) 555-0101'
  from (values ('m', 'mentor'), ('j', 'judge'), ('y', 'hybrid'), ('mP', 'mentor')) as s(k, t);

-- Decisions, released the way the console does it (promote_accepted grants
-- event_roles and makes the check-in roster rows).
update public.applications set status = 'accepted' where id in (select pg_temp.app(k) from unnest(array['hA', 'm', 'j', 'y']) k);
update public.applications set status = 'waitlisted' where id = pg_temp.app('hW');
update public.applications set status = 'rejected' where id = pg_temp.app('hR');

-- Everything else the API could serve.
insert into public.waivers (event_id, user_id, signed_at, envelope_id, source)
select :'ev', pg_temp.uid(k), now(), 'env-' || k, 'docusign_import' from unnest(array['hA', 'm', 'j']) k;
insert into public.checkins (event_id, user_id) values (:'ev', pg_temp.uid('hA')), (:'ev', pg_temp.uid('m'));
insert into public.event_day_settings (event_id, hacker_capacity) values (:'ev', 100);
insert into public.scan_types (event_id, label) values (:'ev', 'Lunch');
insert into public.organizer_invites (event_id, email) values (:'ev', 'invited@example.com');
insert into public.teams (id, event_id, name) values ('66666666-0000-0000-0000-000000000001', :'ev', 'Team A');
insert into public.team_members (team_id, event_id, user_id, role) values ('66666666-0000-0000-0000-000000000001', :'ev', pg_temp.uid('hA'), 'hacker');
insert into public.email_log (event_id, kind, dedupe_key, application_id, status) values (:'ev', 'decision', 'decision:hA', pg_temp.app('hA'), 'sent');
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false) on conflict do nothing;
insert into storage.objects (bucket_id, name) select 'resumes', pg_temp.uid(k) || '/resume.pdf' from unnest(array['hA', 'hP', 'hW', 'hR', 'hD']) k;
insert into storage.objects (bucket_id, name) values ('wallet-passes', :'ev' || '/77777777-0000-0000-0000-000000000001.pkpass');
grant select on storage.objects to anon, authenticated;
-- One real check-in through the desk, so checkin_events has a row.
select pg_temp.expect('setup: organizer checks hA in',
  pg_temp.val_as(pg_temp.uid('org'), 'authenticated',
    format($q$select check_in_by_code(%L, (select code from attendees where application_id = %L)) ->> 'status'$q$, :'ev', pg_temp.app('hA'))), 'ok');
-- An acceptance staged for mP but not released: mP must not learn it, or get in.
select pg_temp.expect('setup: organizer stages an acceptance for mP',
  pg_temp.val_as(pg_temp.uid('org'), 'authenticated',
    format($q$select stage_decisions(%L, array[%L]::uuid[], 'accepted') -> 'updated' ->> 0 is not null$q$, :'ev', pg_temp.app('mP'))), 'true');
select pg_temp.expect('setup: roster and roles as expected',
  (select string_agg(p.key || ':' || er.role, ',' order by p.key, er.role) from event_roles er join people p on p.id = er.user_id where er.event_id = :'ev'),
  'hA:hacker,j:judge,m:mentor,org:organizer,y:mentor,y:judge');


-- 1. Nobody but organizers reads anyone else's rows ---------------------------

do $$
declare
  k text;
  who uuid;
  own_apps int;
begin
  foreach k in array array['hA', 'hP', 'hW', 'hR', 'hD', 'm', 'j', 'y', 'mP', 'n'] loop
    who := pg_temp.uid(k);
    own_apps := case when k = 'n' then 0 else 1 end;

    perform pg_temp.expect(k || ': sees only their own application',
      pg_temp.val_as(who, 'authenticated', $q$select count(*) || '/' || count(*) filter (where user_id = auth.uid()) from applications$q$),
      own_apps || '/' || own_apps);
    perform pg_temp.sees_nothing(k || ': no other applicant''s essay, phone or resume path',
      who, $q$select count(*) from applications where user_id is distinct from auth.uid() and (essay_goal is not null or phone is not null or resume_path is not null)$q$);
    perform pg_temp.expect(k || ': no decision column, even their own',
      pg_temp.as_req(who, 'authenticated', 'select decision from applications'), '42501: %');
    perform pg_temp.sees_nothing(k || ': no one else''s event roles',
      who, 'select count(*) from event_roles where user_id <> auth.uid()');
    perform pg_temp.sees_nothing(k || ': no one else''s profile',
      who, 'select count(*) from profiles where id <> auth.uid()');
    perform pg_temp.sees_nothing(k || ': no one else''s waiver',
      who, 'select count(*) from waivers where user_id <> auth.uid()');
    perform pg_temp.sees_nothing(k || ': no one else''s check-in',
      who, 'select count(*) from checkins where user_id <> auth.uid()');
    perform pg_temp.sees_nothing(k || ': no one else on the check-in list view',
      who, 'select count(*) from v_checkin_list where user_id <> auth.uid()');
    perform pg_temp.sees_nothing(k || ': no roster (names, emails, check-in codes)',
      who, 'select count(*) from attendees');
    perform pg_temp.sees_nothing(k || ': no check-in log', who, 'select count(*) from checkin_events');
    perform pg_temp.sees_nothing(k || ': no scan types', who, 'select count(*) from scan_types');
    perform pg_temp.sees_nothing(k || ': no event-day settings', who, 'select count(*) from event_day_settings');
    perform pg_temp.sees_nothing(k || ': no email log', who, 'select count(*) from email_log');
    perform pg_temp.sees_nothing(k || ': no organizer invites', who, 'select count(*) from organizer_invites');
    perform pg_temp.sees_nothing(k || ': no teams', who, 'select count(*) from teams');
    perform pg_temp.sees_nothing(k || ': no team members', who, 'select count(*) from team_members');
    perform pg_temp.sees_nothing(k || ': no one else''s resume file',
      who, $q$select count(*) from storage.objects where bucket_id = 'resumes' and (storage.foldername(name))[1] <> auth.uid()::text$q$);
    perform pg_temp.sees_nothing(k || ': no wallet pass files',
      who, $q$select count(*) from storage.objects where bucket_id = 'wallet-passes'$q$);
  end loop;
end $$;

select pg_temp.expect('hA can read their own resume file',
  pg_temp.val_as(pg_temp.uid('hA'), 'authenticated', $q$select count(*) from storage.objects where bucket_id = 'resumes'$q$), '1');
select pg_temp.expect('hA can read their own waiver',
  pg_temp.val_as(pg_temp.uid('hA'), 'authenticated', 'select count(*) from waivers'), '1');

-- Mentors and judges are applicants too: they don't see each other, or hackers.
select pg_temp.expect('a judge can''t read the mentor''s application',
  pg_temp.val_as(pg_temp.uid('j'), 'authenticated', format('select count(*) from applications where id = %L', pg_temp.app('m'))), '0');
select pg_temp.expect('a mentor can''t read the judge''s application',
  pg_temp.val_as(pg_temp.uid('m'), 'authenticated', format('select count(*) from applications where id = %L', pg_temp.app('j'))), '0');
select pg_temp.expect('a hybrid can''t read hacker applications',
  pg_temp.val_as(pg_temp.uid('y'), 'authenticated', $q$select count(*) from applications where applicant_type = 'hacker'$q$), '0');
select pg_temp.expect('a hacker can''t read mentor or judge applications',
  pg_temp.val_as(pg_temp.uid('hA'), 'authenticated', $q$select count(*) from applications where applicant_type <> 'hacker'$q$), '0');

-- Signed out.
select pg_temp.sees_nothing('anon: no applications', null, 'select count(*) from applications');
select pg_temp.sees_nothing('anon: no event roles', null, 'select count(*) from event_roles');
select pg_temp.sees_nothing('anon: no profiles', null, 'select count(*) from profiles');
select pg_temp.sees_nothing('anon: no waivers', null, 'select count(*) from waivers');
select pg_temp.sees_nothing('anon: no roster', null, 'select count(*) from attendees');
select pg_temp.sees_nothing('anon: no check-in list', null, 'select count(*) from v_checkin_list');
select pg_temp.sees_nothing('anon: no resume files', null, $q$select count(*) from storage.objects where bucket_id = 'resumes'$q$);
select pg_temp.expect('anon: can''t call the mentor roster',
  pg_temp.as_req(null, 'anon', format('select * from mentor_roster(%L)', :'ev')), '42501: %');

-- An organizer of another event sees none of this one.
select pg_temp.sees_nothing('org2: none of ev''s applications', pg_temp.uid('org2'), format('select count(*) from applications where event_id = %L', :'ev'));
select pg_temp.sees_nothing('org2: none of ev''s roster', pg_temp.uid('org2'), format('select count(*) from attendees where event_id = %L', :'ev'));
select pg_temp.sees_nothing('org2: none of ev''s waivers', pg_temp.uid('org2'), format('select count(*) from waivers where event_id = %L', :'ev'));
select pg_temp.sees_nothing('org2: none of ev''s resumes', pg_temp.uid('org2'), $q$select count(*) from storage.objects where bucket_id = 'resumes'$q$);
select pg_temp.expect('org2: ev''s staged decisions are refused',
  pg_temp.as_req(pg_temp.uid('org2'), 'authenticated', format('select staged_decisions(%L)', :'ev')), 'P0001: Not authorized');

-- The organizer does see them (so the checks above aren't passing on empty tables).
select pg_temp.expect('org: every application of the event',
  pg_temp.val_as(pg_temp.uid('org'), 'authenticated', format('select count(*) from applications where event_id = %L', :'ev')), '9');
select pg_temp.expect('org: the roster',
  pg_temp.val_as(pg_temp.uid('org'), 'authenticated', 'select count(*) from attendees'), '4');
select pg_temp.expect('org: the resumes of their event',
  pg_temp.val_as(pg_temp.uid('org'), 'authenticated', $q$select count(*) from storage.objects where bucket_id = 'resumes'$q$), '5');
select pg_temp.expect('org: the check-in log, email log and waivers',
  pg_temp.val_as(pg_temp.uid('org'), 'authenticated', 'select (select count(*) from checkin_events) || ''/'' || (select count(*) from email_log) || ''/'' || (select count(*) from waivers)'), '1/1/3');
-- ...but not through an AI assistant's (OAuth client) token.
select pg_temp.expect('org through an OAuth client: only their own application (none)',
  pg_temp.val_claims(jsonb_build_object('sub', pg_temp.uid('org'), 'client_id', 'some-ai-app'), 'authenticated', 'select count(*) from applications'), '0');
select pg_temp.expect('org through an OAuth client: no roster',
  pg_temp.val_claims(jsonb_build_object('sub', pg_temp.uid('org'), 'client_id', 'some-ai-app'), 'authenticated', 'select count(*) from attendees'), '0');


-- 2. The organizer console's functions refuse everyone else -------------------

create temp table staff_calls (label text, sql text);
grant select on staff_calls to anon, authenticated;
insert into staff_calls values
  ('staged_decisions',      format('select staged_decisions(%L)', :'ev')),
  ('stage_decisions',       format('select stage_decisions(%L, array[%L]::uuid[], ''accepted'')', :'ev', pg_temp.app('hR'))),
  ('release_decisions',     format('select * from release_decisions(%L)', :'ev')),
  ('waitlist_overview',     format('select waitlist_overview(%L)', :'ev')),
  ('mark_no_shows',         format('select * from mark_no_shows(%L)', :'ev')),
  ('unmark_no_shows',       format('select unmark_no_shows(%L, array[%L]::uuid[])', :'ev', pg_temp.app('hA'))),
  ('offer_waitlist_spots',  format('select * from offer_waitlist_spots(%L, 1)', :'ev')),
  ('accept_walk_in',        format('select accept_walk_in(%L, %L)', :'ev', pg_temp.app('hW'))),
  ('list_organizers',       format('select * from list_organizers(%L)', :'ev')),
  ('add_organizer',         format('select add_organizer(%L, ''n@example.com'')', :'ev')),
  ('remove_organizer',      format('select remove_organizer(%L, ''org@example.com'')', :'ev')),
  ('check_in_attendee',     format('select check_in_attendee(%L, %L)', :'ev', pg_temp.uid('m'))),
  ('check_in_by_code',      format('select check_in_by_code(%L, ''RIT-M001'')', :'ev')),
  ('undo_check_in',         format('select undo_check_in(%L, ''RIT-H001'')', :'ev')),
  ('record_scan',           format('select record_scan(%L, ''RIT-H001'', (select id from scan_types limit 1))', :'ev')),
  ('lookup_not_on_roster',  format('select lookup_not_on_roster(%L, ''hp@example.com'')', :'ev')),
  ('mark_waiver_seen',      format('select mark_waiver_seen(%L, %L)', :'ev', pg_temp.app('hP'))),
  ('record_waivers_import', format($q$select record_waivers_import(%L, '[]'::jsonb)$q$, :'ev')),
  ('email_quota',           format('select email_quota(%L)', :'ev'));

do $$
declare
  k text;
  c record;
  got text;
begin
  foreach k in array array['hA', 'hP', 'hR', 'm', 'j', 'y', 'n'] loop
    for c in select * from staff_calls loop
      got := pg_temp.as_req(pg_temp.uid(k), 'authenticated', c.sql);
      if got like 'P0001: Not authorized%' or got like '42501: %' then
        raise notice 'PASS  %: % refused', k, c.label;
      else
        raise exception 'FAIL  %: % should be refused, got [%]', k, c.label, got;
      end if;
    end loop;
  end loop;
  for c in select * from staff_calls loop
    got := pg_temp.as_req(null, 'anon', c.sql);
    if got like '42501: %' or got like 'P0001: Not authorized%' then raise notice 'PASS  anon: % refused', c.label;
    else raise exception 'FAIL  anon: % should be refused, got [%]', c.label, got; end if;
  end loop;
end $$;

-- Service-role-only helpers aren't callable from the browser at all.
do $$
declare
  k text;
  s text;
begin
  foreach k in array array['hA', 'm', 'j'] loop
    foreach s in array array[
      format('select upsert_attendee(%L)', pg_temp.app('hR')),
      format('select next_attendee_code(%L, array[''judge''])', current_setting('my.ev')),
      'select * from waitlist_capacity(gen_random_uuid())',
      'select give_waitlist_spot(gen_random_uuid(), 60)',
      'select claim_email(gen_random_uuid(), ''blast'', ''k'', null)',
      'select finish_email(''k'', true)'
    ] loop
      perform pg_temp.expect(k || ': ' || split_part(s, '(', 1) || ' not callable',
        pg_temp.as_req(pg_temp.uid(k), 'authenticated', s), '42501: %');
    end loop;
  end loop;
end $$;


-- 3. Nobody can make themselves staff, or see a decision early ----------------

do $$
declare
  k text;
  who uuid;
  ev uuid := current_setting('my.ev')::uuid;
begin
  foreach k in array array['hA', 'hP', 'hR', 'm', 'n'] loop
    who := pg_temp.uid(k);
    perform pg_temp.expect(k || ': can''t grant themselves a judge role',
      pg_temp.as_req(who, 'authenticated', format($q$insert into event_roles (event_id, user_id, role) values (%L, %L, 'judge')$q$, ev, who)), '42501: %');
    perform pg_temp.expect(k || ': can''t grant themselves the organizer role',
      pg_temp.as_req(who, 'authenticated', format($q$insert into event_roles (event_id, user_id, role) values (%L, %L, 'organizer')$q$, ev, who)), '42501: %');
    perform pg_temp.expect(k || ': can''t invite themselves as an organizer',
      pg_temp.as_req(who, 'authenticated', format($q$insert into organizer_invites (event_id, email) values (%L, %L)$q$, ev, k || '@example.com')), '42501: %');
    perform pg_temp.expect(k || ': can''t write a waiver',
      pg_temp.as_req(who, 'authenticated', format($q$insert into waivers (event_id, user_id, signed_at, envelope_id) values (%L, %L, now(), 'x')$q$, ev, who)), '42501: %');
    perform pg_temp.expect(k || ': can''t add themselves to the roster',
      pg_temp.as_req(who, 'authenticated', format($q$insert into attendees (event_id, user_id, code, name, roles) values (%L, %L, 'RIT-J999', 'x', array['judge'])$q$, ev, who)), '42501: %');
  end loop;
end $$;

-- Their own application can't be turned into an accepted staff one.
select pg_temp.expect('a pending hacker can''t accept themselves',
  pg_temp.as_req(pg_temp.uid('hP'), 'authenticated', $q$update applications set status = 'accepted' where user_id = auth.uid()$q$), 'ok');
select pg_temp.expect('a pending hacker can''t switch to judge after submitting',
  pg_temp.as_req(pg_temp.uid('hP'), 'authenticated', $q$update applications set applicant_type = 'judge' where user_id = auth.uid()$q$), 'ok');
select pg_temp.expect('an accepted hacker can''t switch to judge',
  pg_temp.as_req(pg_temp.uid('hA'), 'authenticated', $q$update applications set applicant_type = 'judge', judging_track = 'entertainment' where user_id = auth.uid()$q$), 'ok');
select pg_temp.expect('...both rows unchanged',
  (select string_agg(applicant_type || '/' || status, ',' order by first_name) from applications where id in (pg_temp.app('hA'), pg_temp.app('hP'))),
  'hacker/accepted,hacker/submitted');
select pg_temp.expect('a draft can''t be saved as accepted',
  pg_temp.as_req(pg_temp.uid('hD'), 'authenticated', $q$update applications set status = 'accepted' where user_id = auth.uid()$q$), '42501: %');
select pg_temp.expect('a hacker can''t file a second (judge) application for the event',
  pg_temp.as_req(pg_temp.uid('hA'), 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title,
      linkedin_url, ucsd_affiliation, judging_track, acknowledged_in_person_judging) values (auth.uid(), %L, 'judge', 'submitted', 'x', 'o', 'r', 'https://x.io', 'none', 'entertainment', true)$q$, :'ev')),
  '23505: %');
select pg_temp.expect('someone new can''t apply already accepted',
  pg_temp.as_req(pg_temp.uid('n'), 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title,
      linkedin_url, ucsd_affiliation, judging_track, acknowledged_in_person_judging) values (auth.uid(), %L, 'judge', 'accepted', 'x', 'o', 'r', 'https://x.io', 'none', 'entertainment', true)$q$, :'ev')),
  '42501: %');
select pg_temp.expect('...or with a decision already on it',
  pg_temp.as_req(pg_temp.uid('n'), 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, decision, first_name, organization, role_title,
      linkedin_url, ucsd_affiliation, judging_track, acknowledged_in_person_judging) values (auth.uid(), %L, 'judge', 'submitted', 'accepted', 'x', 'o', 'r', 'https://x.io', 'none', 'entertainment', true)$q$, :'ev')),
  'ok');
select pg_temp.expect('...the decision is dropped and no role is granted',
  (select coalesce(decision, 'none') || '/' || status || '/' || (select count(*) from event_roles where user_id = pg_temp.uid('n')) from applications where user_id = pg_temp.uid('n')),
  'none/submitted/0');
select pg_temp.expect('a profile can''t claim a role',
  pg_temp.as_req(pg_temp.uid('hP'), 'authenticated', $q$update profiles set role = 'judge' where id = auth.uid()$q$), 'ok');
select pg_temp.expect('...it stays hacker', (select role::text from profiles where id = pg_temp.uid('hP')), 'hacker');
select pg_temp.expect('nobody can edit another applicant''s application',
  pg_temp.as_req(pg_temp.uid('hD'), 'authenticated', format($q$update applications set first_name = 'pwned', essay_goal = 'pwned' where id = %L$q$, pg_temp.app('hP'))), 'ok');
select pg_temp.expect('...unchanged', (select first_name from applications where id = pg_temp.app('hP')), 'hP');
select pg_temp.expect('nobody can delete an application',
  pg_temp.as_req(pg_temp.uid('hA'), 'authenticated', format('delete from applications where id in (%L, %L)', pg_temp.app('hA'), pg_temp.app('hP'))), 'ok');
select pg_temp.expect('...both still there', (select count(*)::text from applications where id in (pg_temp.app('hA'), pg_temp.app('hP'))), '2');
select pg_temp.expect('nobody can open or rename an event',
  pg_temp.as_req(pg_temp.uid('m'), 'authenticated', format($q$update events set name = 'pwned', applications_open = false where id = %L$q$, :'ev')), 'ok');
select pg_temp.expect('...unchanged', (select name || '/' || applications_open from events where id = :'ev'), 'Isolation Test/true');
select pg_temp.expect('a hacker''s waitlist opt-in only ever touches their own row',
  pg_temp.as_req(pg_temp.uid('hA'), 'authenticated', format('select set_waitlist_opt_in(%L, true)', :'ev')), 'P0001: Only waitlisted%');
select pg_temp.expect('a mentor has no hacker application to agree to MLH on',
  pg_temp.as_req(pg_temp.uid('m'), 'authenticated', format('select agree_to_mlh(%L, false)', :'ev')), 'P0001: You don''t have a hacker application%');

-- mP's acceptance is staged but not released.
select pg_temp.expect('mP still sees "submitted"',
  pg_temp.val_as(pg_temp.uid('mP'), 'authenticated', 'select status from applications'), 'submitted');
select pg_temp.expect('mP can''t read the staged decision',
  pg_temp.as_req(pg_temp.uid('mP'), 'authenticated', 'select decision from applications'), '42501: %');
select pg_temp.expect('mP has no mentor role yet',
  pg_temp.val_as(pg_temp.uid('mP'), 'authenticated', 'select count(*) from event_roles'), '0');


-- 4. The hackers' Mentors tab ------------------------------------------------

select pg_temp.expect('an accepted hacker sees accepted mentors and hybrids only (names, bio, checked in)',
  pg_temp.val_as(pg_temp.uid('hA'), 'authenticated',
    format($q$select string_agg(first_name || ':' || coalesce(bio, '') || ':' || checked_in, ',' order by first_name) from mentor_roster(%L)$q$, :'ev')),
  'm:bio of m:false,y:bio of y:false');
select pg_temp.expect('...and nothing else about them (no email, phone or employer)',
  (select string_agg(a, ',' order by a) from unnest((select proargnames from pg_proc where proname = 'mentor_roster')) a where a <> 'p_event_id'),
  'bio,checked_in,first_name,last_name');
do $$
declare k text;
begin
  foreach k in array array['hP', 'hW', 'hR', 'hD', 'mP', 'n', 'org2'] loop
    perform pg_temp.expect(k || ': no mentor roster without a role at the event',
      pg_temp.as_req(pg_temp.uid(k), 'authenticated', format('select * from mentor_roster(%L)', current_setting('my.ev'))), 'P0001: Not authorized');
  end loop;
end $$;
select pg_temp.expect('an accepted hacker can''t read another event''s mentors',
  pg_temp.as_req(pg_temp.uid('hA'), 'authenticated', format('select * from mentor_roster(%L)', :'ev2')), 'P0001: Not authorized');
