-- Public live stats (migration *_public_event_stats.sql): anyone can read the
-- counts, no one can read a row, small groups are never named, drafts don't
-- count, and only events switched public answer.
-- Run with supabase/tests/run.sh. Each check prints PASS or raises FAIL.
\set ON_ERROR_STOP on

-- The real event and the test event (DH26 comes from baseline_data), then the
-- migration again (it is safe to re-run) so it sees DH27.
insert into public.events (id, name, code, applications_open) values
  ('00000000-0000-0000-0000-0000000000b1', 'DataHacks 2027 Beta', 'DH27BETA', true),
  ('00000000-0000-0000-0000-0000000000d7', 'DataHacks 2027', 'DH27', true);
set client_min_messages = warning;
\ir ../migrations/20261110002651_public_event_stats.sql
set client_min_messages = notice;

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

-- p_n hacker applications with these answers, submitted p_days_ago days ago (noon, Pacific).
create function pg_temp.hackers(p_event uuid, p_status text, p_n integer, p_school text, p_major text, p_level text,
                                p_year text, p_exp text, p_before boolean, p_country text, p_days_ago integer)
  returns void language sql as $$
  insert into public.applications (event_id, applicant_type, status, submitted_at, first_name, last_name, email, phone,
                                   school, major, level_of_study, graduation_year, hackathon_experience, attended_before,
                                   country_of_residence, gender, essay_goal, linkedin_url)
  select p_event, 'hacker', p_status,
         case when p_status = 'draft' then null
              else (((now() at time zone 'America/Los_Angeles')::date - p_days_ago) + time '12:00') at time zone 'America/Los_Angeles' end,
         'Secretname', 'Person' || i, 'secret' || i || '@example.com', '(858) 555-0101',
         p_school, p_major, p_level, p_year, p_exp, p_before, p_country, 'Woman', 'A private essay', 'https://linkedin.com/in/secret'
    from generate_series(1, p_n) as i $$;

\set dh27 '00000000-0000-0000-0000-0000000000d7'
\set beta '00000000-0000-0000-0000-0000000000b1'
\set ba '''Undergraduate (3+ year: bachelor''''s)'''
\set grad '''Graduate (master''''s, doctoral)'''

-- DH27, submitted (23 hackers, one waitlisted and one rejected among them):
--   schools  UCSD 12 (one typed in lower case, with spaces), SDSU 5, Tiny College 4, Small U 2
--   majors   Data Science 10 (3 in lower case), Computer Science 9, Physics 4
--   levels   bachelor's 12, "Other" 6, graduate 3, high school 2
--   years    2027 10, 2028 7, 2029 5, already graduated 1
--   first hackathon 10, been to DataHacks 6, countries 2 (US 21, Canada 2)
--   per day  12 two days ago, none yesterday, 11 today
select pg_temp.hackers(:'dh27', 'submitted', 7, 'University of California, San Diego', 'Data Science', :ba, '2027', 'This will be my first', false, 'United States', 2);
select pg_temp.hackers(:'dh27', 'submitted', 3, 'University of California, San Diego', ' data science', :ba, '2027', 'This will be my first', true, 'United States', 2);
select pg_temp.hackers(:'dh27', 'waitlisted', 1, ' university of california, san diego ', 'Computer Science', :ba, '2028', '1–2 hackathons', true, 'United States', 2);
select pg_temp.hackers(:'dh27', 'rejected', 1, 'University of California, San Diego', 'Computer Science', :ba, '2028', '1–2 hackathons', false, 'United States', 2);
select pg_temp.hackers(:'dh27', 'submitted', 5, 'San Diego State University', 'Computer Science', 'Other', '2028', '3–5 hackathons', false, 'United States', 0);
select pg_temp.hackers(:'dh27', 'submitted', 2, 'Tiny College', 'Computer Science', :grad, '2029', '6 or more', true, 'Canada', 0);
select pg_temp.hackers(:'dh27', 'submitted', 2, 'Tiny College', 'Physics', 'High school', '2029', '6 or more', false, 'United States', 0);
select pg_temp.hackers(:'dh27', 'submitted', 1, 'Small U', 'Physics', :grad, '2029', '1–2 hackathons', false, 'United States', 0);
select pg_temp.hackers(:'dh27', 'submitted', 1, 'Small U', 'Physics', 'Other', 'Already graduated', '1–2 hackathons', false, 'United States', 0);
-- Drafts never count, however many.
select pg_temp.hackers(:'dh27', 'draft', 7, 'Draft University', 'Draft Studies', :ba, '2027', 'This will be my first', true, 'Mexico', 0);
-- The test event's applicants never show.
select pg_temp.hackers(:'beta', 'submitted', 8, 'Beta School', 'Data Science', :ba, '2027', 'This will be my first', false, 'United States', 0);
-- Mentors and judges: 3 submitted, 1 draft.
insert into public.applications (event_id, applicant_type, status, submitted_at, email, first_name, organization, role_title,
                                 linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring, judging_track, acknowledged_in_person_judging)
values
  (:'dh27', 'mentor', 'submitted', now(), 'mentor1@example.com', 'Mentorname', 'Org', 'Eng', 'https://l.example.com/a', 'none', true, null, false),
  (:'dh27', 'mentor', 'submitted', now(), 'mentor2@example.com', 'Mentorname', 'Org', 'Eng', 'https://l.example.com/b', 'none', true, null, false),
  (:'dh27', 'judge', 'submitted', now(), 'judge1@example.com', 'Judgename', 'Org', 'Eng', 'https://l.example.com/c', 'none', false, 'entertainment', true),
  (:'dh27', 'mentor', 'draft', null, 'mentor3@example.com', 'Mentorname', 'Org', 'Eng', 'https://l.example.com/d', 'none', true, null, false);

create temporary table out as
  select pg_temp.val_as(null, 'anon', $q$select public_event_stats('DH27')::text$q$)::jsonb as s;


-- 1. The switch ---------------------------------------------------------------
select pg_temp.expect('only DH27 is public',
  (select string_agg(code || '=' || stats_public, ',' order by code) from events), 'DH26=false,DH27=true,DH27BETA=false');
insert into events (name, code) values ('X', 'XTMP');
select pg_temp.expect('a new event starts private', (select stats_public::text from events where code = 'XTMP'), 'false');
delete from events where code = 'XTMP';


-- 2. Anyone can read the counts; no one can read a row ------------------------
select pg_temp.expect('anon gets the stats', (select s ->> 'event' from out), 'DH27');
select pg_temp.expect('a signed-in applicant gets them too',
  pg_temp.val_as('11111111-0000-0000-0000-000000000001', 'authenticated', $q$select public_event_stats('DH27') ->> 'hackers'$q$), '23');
select pg_temp.expect('the code is case-insensitive',
  pg_temp.val_as(null, 'anon', $q$select public_event_stats(' dh27 ') ->> 'hackers'$q$), '23');
select pg_temp.expect('anon still reads no application rows',
  pg_temp.val_as(null, 'anon', $q$select count(*)::text from applications$q$), '0');
select pg_temp.expect('anon cannot call the list helper',
  pg_temp.val_as(null, 'anon', $q$select public_stats_buckets(array['a'], 1)::text$q$), '42501: permission denied%');
select pg_temp.expect('security definer, with an empty search_path',
  (select prosecdef::text || ' ' || array_to_string(proconfig, ',') from pg_proc where oid = 'public.public_event_stats(text)'::regprocedure),
  'true search_path=""');
select pg_temp.expect('PUBLIC has no execute grant (only the API roles)',
  (select count(*)::text from information_schema.routine_privileges
    where routine_name = 'public_event_stats' and grantee = 'PUBLIC'), '0');


-- 3. The totals -----------------------------------------------------------------
select pg_temp.expect('hackers: submitted, waitlisted and rejected count; drafts don''t', (select s ->> 'hackers' from out), '23');
select pg_temp.expect('schools represented (case and spaces ignored)', (select s ->> 'schools' from out), '4');
select pg_temp.expect('first-time hackers', (select s ->> 'first_time' from out), '10');
select pg_temp.expect('been to DataHacks before', (select s ->> 'attended_before' from out), '6');
select pg_temp.expect('countries', (select s ->> 'countries' from out), '2');
select pg_temp.expect('mentors and judges: the submitted total only', (select s ->> 'mentors_judges' from out), '3');


-- 4. Lists: under 5 is never named ---------------------------------------------
select pg_temp.expect('schools: small ones folded into Other, most common spelling',
  (select s ->> 'top_schools' from out),
  '[{"count": 12, "label": "University of California, San Diego"}, {"count": 5, "label": "San Diego State University"}, {"count": 6, "label": "Other"}]');
select pg_temp.expect('majors: Other under 5 is left out',
  (select s ->> 'majors' from out),
  '[{"count": 10, "label": "Data Science"}, {"count": 9, "label": "Computer Science"}]');
select pg_temp.expect('levels: the "Other" answer and the small levels make one Other',
  (select s ->> 'levels' from out),
  '[{"count": 12, "label": "Undergraduate (3+ year: bachelor''s)"}, {"count": 11, "label": "Other"}]');
select pg_temp.expect('graduation years: one "Already graduated" isn''t named, and Other (1) is left out',
  (select s ->> 'graduation_years' from out),
  '[{"count": 10, "label": "2027"}, {"count": 7, "label": "2028"}, {"count": 5, "label": "2029"}]');
select pg_temp.expect('a group of exactly 5 is named; 4 go to Other, which is then left out',
  (public.public_stats_buckets(array['A','A','A','A','A','B','B','B','B'], 10))::text, '[{"count": 5, "label": "A"}]');
select pg_temp.expect('only the top N are named; the rest fold into Other',
  (public.public_stats_buckets(array['A','A','A','A','A','A','B','B','B','B','B','C','C','C','C','C'], 2))::text,
  '[{"count": 6, "label": "A"}, {"count": 5, "label": "B"}, {"count": 5, "label": "Other"}]');
select pg_temp.expect('blank and missing answers are skipped',
  (public.public_stats_buckets(array['', '  ', null, 'A','A','A','A','A'], 10))::text, '[{"count": 5, "label": "A"}]');
select pg_temp.expect('no applications: empty lists', (public.public_stats_buckets(null, 10))::text, '[]');


-- 5. Per day ----------------------------------------------------------------------
select pg_temp.expect('per day: every day from the first application to today',
  (select jsonb_array_length(s -> 'per_day')::text from out), '3');
select pg_temp.expect('per day: counts and running total',
  (select string_agg((d ->> 'count') || '/' || (d ->> 'total'), ',') from out, jsonb_array_elements(s -> 'per_day') d), '12/12,0/12,11/23');
select pg_temp.expect('per day: the last day is today in Pacific time',
  (select s -> 'per_day' -> -1 ->> 'date' from out), to_char((now() at time zone 'America/Los_Angeles')::date, 'YYYY-MM-DD'));


-- 6. Nothing about a person ---------------------------------------------------------
select pg_temp.expect('only the documented keys',
  (select string_agg(k, ',' order by k) from out, jsonb_object_keys(s) k),
  'attended_before,countries,event,first_time,generated_at,graduation_years,hackers,levels,majors,mentors_judges,per_day,schools,top_schools');
select pg_temp.expect('no names, emails, phones, essays, links, gender or small schools in the output',
  (select (s::text ~* 'secret|person|mentorname|judgename|@|555|essay|linkedin|woman|tiny college|small u|physics|draft|beta|mexico')::text from out),
  'false');


-- 7. Only public events -----------------------------------------------------------
select pg_temp.expect('the test event is refused',
  pg_temp.val_as(null, 'anon', $q$select public_event_stats('DH27BETA')::text$q$), 'P0002: There are no public stats for that event.');
select pg_temp.expect('last year''s event is refused',
  pg_temp.val_as(null, 'anon', $q$select public_event_stats('DH26')::text$q$), 'P0002: There are no public stats for that event.');
select pg_temp.expect('an unknown code gets the same answer',
  pg_temp.val_as(null, 'anon', $q$select public_event_stats('NOPE')::text$q$), 'P0002: There are no public stats for that event.');
select pg_temp.expect('no code gets the same answer',
  pg_temp.val_as(null, 'anon', $q$select public_event_stats(null)::text$q$), 'P0002: There are no public stats for that event.');
select pg_temp.expect('anon cannot switch an event public',
  pg_temp.val_as(null, 'anon', $q$with u as (update events set stats_public = true where code = 'DH27BETA' returning 1) select count(*)::text from u$q$), '0');
select pg_temp.expect('an applicant cannot either',
  pg_temp.val_as('11111111-0000-0000-0000-000000000001', 'authenticated', $q$with u as (update events set stats_public = true where code = 'DH27BETA' returning 1) select count(*)::text from u$q$), '0');
update events set stats_public = false where code = 'DH27';
select pg_temp.expect('switched off, DH27 is refused too',
  pg_temp.val_as(null, 'anon', $q$select public_event_stats('DH27')::text$q$), 'P0002: There are no public stats for that event.');
update events set stats_public = true where code = 'DH27';


-- 8. No applications yet --------------------------------------------------------------
delete from applications where event_id = :'dh27';
select pg_temp.expect('an event with no applications: zeros and empty lists',
  pg_temp.val_as(null, 'anon', $q$select s ->> 'hackers' || '/' || (s ->> 'schools') || '/' || (s ->> 'mentors_judges') || '/' || (s -> 'top_schools')::text || '/' || (s -> 'per_day')::text
    from public_event_stats('DH27') s$q$), '0/0/0/[]/[]');
