-- The accounts counts on the public live stats (migration *_public_stats_accounts.sql):
-- who counts as an account this cycle, which of them have submitted, and that
-- organizers, test emails, other events' applications and drafts are handled
-- right. Only the two totals come out.
-- Run with supabase/tests/run.sh. Each check prints PASS or raises FAIL.
\set ON_ERROR_STOP on

-- Runs one statement as a request: sub = user id (null = no user), role = API role.
-- Returns the statement's single value as text, or 'SQLSTATE: message'.
create function pg_temp.val_as(p_sub uuid, p_role text, p_sql text) returns text language plpgsql as $$
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

-- What the page reads, as anon: "accounts/accounts_submitted".
create function pg_temp.counts(p_code text) returns text language sql as $$
  select pg_temp.val_as(null, 'anon', format(
    $q$select (s ->> 'accounts') || '/' || (s ->> 'accounts_submitted') from public_event_stats(%L) s$q$, p_code)) $$;

\set dh26 '96f5c446-76df-4001-948c-67c01a56ebcf'
\set dh27 '00000000-0000-0000-0000-0000000000d7'
\set beta '00000000-0000-0000-0000-0000000000b1'
\set dh28 '00000000-0000-0000-0000-0000000000d8'

-- DH27 opened for applications on Oct 25, 9 AM Pacific; its first application came in on Nov 4.
insert into public.events (id, name, code, applications_open, applications_open_at, stats_public) values
  (:'beta', 'DataHacks 2027 Beta', 'DH27BETA', true, null, false),
  (:'dh27', 'DataHacks 2027', 'DH27', true, '2026-10-25 09:00-07', true),
  (:'dh28', 'DataHacks 2028', 'DH28', true, null, true);

-- Accounts. "Old" ones were made in September 2025, before this cycle.
insert into auth.users (id, email, email_confirmed_at, created_at, last_sign_in_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'new.idle@ucsd.edu',            now(), '2026-10-28 12:00-07', '2026-10-28 12:00-07'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'new.hacker@ucsd.edu',          now(), '2026-11-05 11:00-08', '2026-11-05 11:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'new.draft@ucsd.edu',           now(), '2026-11-06 11:00-08', '2026-11-06 11:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'returning@ucsd.edu',           now(), '2025-09-01 12:00-07', '2026-11-10 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'old.mentor@company.com',       now(), '2025-09-01 12:00-07', '2025-09-02 12:00-07'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'old.draft@ucsd.edu',           now(), '2025-09-01 12:00-07', null),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'last.year@ucsd.edu',           now(), '2025-09-01 12:00-07', '2026-03-01 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'beta.only@ucsd.edu',           now(), '2026-11-08 12:00-08', '2026-11-08 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'organizer@ucsd.edu',           now(), '2026-11-01 12:00-07', '2026-11-01 12:00-07'),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'organizer2@ucsd.edu',          now(), '2025-09-01 12:00-07', '2026-11-12 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'hacker7@loadtest.example.com', now(), '2026-11-09 12:00-08', '2026-11-09 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Someone@Example.com',          now(), '2026-11-09 12:00-08', '2026-11-09 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'me@notexample.com',            now(), '2026-11-09 12:00-08', '2026-11-09 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000014', null,                           null,  '2026-11-09 12:00-08', '2026-11-09 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000015', 'old.idle@ucsd.edu',            now(), '2025-09-01 12:00-07', '2025-09-01 12:00-07'),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'both@company.com',             now(), '2026-11-03 12:00-08', '2026-11-03 12:00-08'),
  ('aaaaaaaa-0000-0000-0000-000000000017', 'on.the.dot@ucsd.edu',          now(), '2026-10-25 09:00-07', '2026-10-25 09:00-07'),
  ('aaaaaaaa-0000-0000-0000-000000000018', 'back.on.the.dot@ucsd.edu',     now(), '2025-09-01 12:00-07', '2026-11-04 10:00-08');
insert into public.profiles (id, email) select id, email from auth.users where email is not null;

-- Organizers: one on last year's event, one on this one. A mentor role is not an organizer role.
insert into public.event_roles (event_id, user_id, role) values
  (:'dh26', 'aaaaaaaa-0000-0000-0000-000000000009', 'organizer'),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000010', 'organizer'),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000005', 'mentor');

-- Applications. Old mentor's, on Nov 4 at 10 AM, is DH27's earliest.
insert into public.applications (event_id, user_id, applicant_type, status, created_at, submitted_at, first_name) values
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000002', 'hacker', 'submitted', '2026-11-05 11:30-08', '2026-11-05 12:00-08', 'Secretname'),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000003', 'hacker', 'draft',     '2026-11-06 12:00-08', null,                  'Secretname'),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000006', 'hacker', 'draft',     '2026-11-07 12:00-08', null,                  'Secretname'),
  (:'dh26', 'aaaaaaaa-0000-0000-0000-000000000007', 'hacker', 'submitted', '2026-02-01 12:00-08', '2026-02-01 12:00-08', 'Secretname'),
  (:'beta', 'aaaaaaaa-0000-0000-0000-000000000008', 'hacker', 'submitted', '2026-11-08 12:00-08', '2026-11-08 12:00-08', 'Secretname'),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000009', 'hacker', 'submitted', '2026-11-05 13:00-08', '2026-11-05 13:00-08', 'Secretname'),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000011', 'hacker', 'submitted', '2026-11-09 12:00-08', '2026-11-09 12:00-08', 'Secretname'),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000012', 'hacker', 'submitted', '2026-11-09 12:00-08', '2026-11-09 12:00-08', 'Secretname');
insert into public.applications (event_id, user_id, applicant_type, status, created_at, submitted_at, email, first_name, organization,
                                 role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring, judging_track,
                                 acknowledged_in_person_judging)
values
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000005', 'mentor', 'submitted', '2026-11-04 09:00-08', '2026-11-04 10:00-08',
   'old.mentor@company.com', 'Mentorname', 'Org', 'Eng', 'https://l.example.com/a', 'none', true, null, false),
  (:'dh27', 'aaaaaaaa-0000-0000-0000-000000000016', 'hybrid', 'submitted', '2026-11-06 08:00-08', '2026-11-06 09:00-08',
   'both@company.com', 'Bothname', 'Org', 'Eng', 'https://l.example.com/b', 'none', true, 'entertainment', true),
  -- A judge who applied without an account: an application, but no account to count.
  (:'dh27', null, 'judge', 'submitted', '2026-11-11 12:00-08', '2026-11-11 12:00-08',
   'judge@company.com', 'Judgename', 'Org', 'Eng', 'https://l.example.com/c', 'none', false, 'entertainment', true);

create temporary table out as
  select pg_temp.val_as(null, 'anon', $q$select public_event_stats('DH27')::text$q$)::jsonb as s;


-- 1. From the day applications opened -----------------------------------------------
-- Counted (12): new idle, new hacker, new draft, returning, old mentor, old draft,
-- beta only, me@notexample.com, the account with no email, both, on the dot,
-- back on the dot. Submitted (3): new hacker, old mentor, both.
select pg_temp.expect('accounts this cycle', (select s ->> 'accounts' from out), '12');
select pg_temp.expect('of them, submitted an application of any type', (select s ->> 'accounts_submitted' from out), '3');
select pg_temp.expect('a signed-in applicant gets the same counts',
  pg_temp.val_as('aaaaaaaa-0000-0000-0000-000000000002', 'authenticated',
    $q$select (s ->> 'accounts') || '/' || (s ->> 'accounts_submitted') from public_event_stats('DH27') s$q$), '12/3');
select pg_temp.expect('the other counts are as before: organizers'' and test applications still count there',
  (select (s ->> 'hackers') || '/' || (s ->> 'mentors_judges') from out), '4/3');


-- 2. Each rule on its own ------------------------------------------------------------
-- Each check makes one change, reads the counts and rolls the change back.
create function pg_temp.counts_if(p_change text) returns text language plpgsql as $$
declare v text;
begin
  begin
    execute p_change;
    v := pg_temp.counts('DH27');
    raise exception 'undo' using errcode = 'UNDO0';
  exception when sqlstate 'UNDO0' then null;
  end;
  return v;
end $$;

select pg_temp.expect('a new account with no application counts, not as submitted',
  pg_temp.counts_if($q$update auth.users set created_at = '2025-09-01 12:00-07', last_sign_in_at = null
                        where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$), '11/3');
select pg_temp.expect('an old account counts once it signs in this cycle',
  pg_temp.counts_if($q$update auth.users set last_sign_in_at = '2026-10-01 12:00-07' where id = 'aaaaaaaa-0000-0000-0000-000000000004'$q$), '11/3');
select pg_temp.expect('an old account that hasn''t signed in counts through its submitted mentor application',
  pg_temp.counts_if($q$delete from applications where user_id = 'aaaaaaaa-0000-0000-0000-000000000005'$q$), '11/2');
select pg_temp.expect('a draft makes an old account count, but not as submitted',
  pg_temp.counts_if($q$delete from applications where user_id = 'aaaaaaaa-0000-0000-0000-000000000006'$q$), '11/3');
select pg_temp.expect('submitting a draft makes it submitted',
  pg_temp.counts_if($q$update applications set status = 'submitted', submitted_at = '2026-11-08 12:00-08'
                        where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$), '12/4');
select pg_temp.expect('an organizer of any event is left out: last year''s, once not one, counts with its DH27 application',
  pg_temp.counts_if($q$delete from event_roles where user_id = 'aaaaaaaa-0000-0000-0000-000000000009'$q$), '13/4');
select pg_temp.expect('an applicant made an organizer of another event drops out of both counts',
  pg_temp.counts_if($q$insert into event_roles (event_id, user_id, role)
                        values ('00000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000002', 'organizer')$q$), '11/2');
select pg_temp.expect('a judge role isn''t an organizer role',
  pg_temp.counts_if($q$insert into event_roles (event_id, user_id, role)
                        values ('00000000-0000-0000-0000-0000000000d7', 'aaaaaaaa-0000-0000-0000-000000000013', 'judge')$q$), '12/3');
select pg_temp.expect('the loadtest.example.com account would count with a real email',
  pg_temp.counts_if($q$update auth.users set email = 'hacker7@ucsd.edu' where id = 'aaaaaaaa-0000-0000-0000-000000000011'$q$), '13/4');
select pg_temp.expect('the example.com account (in any case) would count with a real email',
  pg_temp.counts_if($q$update auth.users set email = 'someone@ucsd.edu' where id = 'aaaaaaaa-0000-0000-0000-000000000012'$q$), '13/4');
select pg_temp.expect('a DH27BETA application isn''t a DH27 one: a DH27 application makes that account submitted',
  pg_temp.counts_if($q$insert into applications (event_id, user_id, applicant_type, status, submitted_at, first_name)
                        values ('00000000-0000-0000-0000-0000000000d7', 'aaaaaaaa-0000-0000-0000-000000000008',
                                'hacker', 'submitted', '2026-11-08 12:00-08', 'Secretname')$q$), '12/4');
select pg_temp.expect('nor is a DH26 one: a DH27 draft makes last year''s account count',
  pg_temp.counts_if($q$insert into applications (event_id, user_id, applicant_type, status, first_name)
                        values ('00000000-0000-0000-0000-0000000000d7', 'aaaaaaaa-0000-0000-0000-000000000007', 'hacker', 'draft', 'Secretname')$q$), '13/3');
select pg_temp.expect('an application sent without an account adds no account',
  pg_temp.counts_if($q$delete from applications where user_id is null$q$), '12/3');
select pg_temp.expect('nothing above stuck', pg_temp.counts('DH27'), '12/3');


-- 3. No opening date: from the event's first application ------------------------------
-- That's old mentor's, Nov 4 at 10 AM. New idle and on the dot (made before then,
-- no application) drop out; back on the dot signed in at that very moment and
-- stays. DH26's February application doesn't move the start back, so last year
-- stays out.
update events set applications_open_at = null where id = :'dh27';
select pg_temp.expect('without applications_open_at, the cycle starts at the first application', pg_temp.counts('DH27'), '10/3');
select pg_temp.expect('a draft started earlier moves the start back',
  pg_temp.counts_if($q$update applications set created_at = '2026-10-01 12:00-07' where user_id = 'aaaaaaaa-0000-0000-0000-000000000006'$q$), '12/3');
update events set applications_open_at = '2026-10-25 09:00-07' where id = :'dh27';

select pg_temp.expect('an event with no applications and no opening date: zero, not everyone who signed in lately',
  pg_temp.counts('DH28'), '0/0');


-- 4. Nothing about a person -------------------------------------------------------------
select pg_temp.expect('the new counts are two numbers',
  (select jsonb_typeof(s -> 'accounts') || ' ' || jsonb_typeof(s -> 'accounts_submitted') from out), 'number number');
select pg_temp.expect('no emails, ids or names in the output',
  (select (s::text ~* '@|ucsd|company|example|aaaaaaaa|[0-9a-f]{8}-[0-9a-f]{4}-|secretname|mentorname|judgename|bothname')::text from out), 'false');
select pg_temp.expect('anon still reads no accounts',
  pg_temp.val_as(null, 'anon', $q$select count(*)::text from auth.users$q$), '42501: permission denied%');
select pg_temp.expect('still security definer, with an empty search_path',
  (select prosecdef::text || ' ' || array_to_string(proconfig, ',') from pg_proc where oid = 'public.public_event_stats(text)'::regprocedure),
  'true search_path=""');
select pg_temp.expect('the same execute grants: the API roles and its owner, not PUBLIC',
  (select string_agg(grantee, ',' order by grantee) from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'public_event_stats' and privilege_type = 'EXECUTE'),
  'anon,authenticated,postgres,service_role');
