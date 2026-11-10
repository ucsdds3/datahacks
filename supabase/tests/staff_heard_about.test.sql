-- Mentor/judge applications' own "how did you hear about DataHacks?" options
-- (migration *_staff_heard_about.sql). Run with supabase/tests/run.sh.
\set ON_ERROR_STOP on

create function pg_temp.as_req(p_sub uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare v text := 'ok';
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_sub, 'role', p_role)::text, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
  exception when others then v := sqlstate || ': ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create function pg_temp.val_as(p_sub uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_sub, 'role', p_role)::text, true);
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
-- A staff application as the forms send it, by that user: type, and heard_about as an SQL literal.
create function pg_temp.staff(p_user uuid, p_event uuid, p_type text, p_heard text) returns text language sql as $$
  select pg_temp.as_req(p_user, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title, linkedin_url,
         ucsd_affiliation, judging_track, acknowledged_in_person_judging, acknowledged_onsite_mentoring, acknowledged_in_person, heard_about)
       values (%L, %L, %L, 'submitted', 'Jo', 'Databricks', 'Engineer', 'https://linkedin.com/in/x', 'none',
         case when %L = 'mentor' then null else 'finance' end, %L <> 'mentor', %L <> 'judge', true, %s)$q$,
    p_user, p_event, p_type, p_type, p_type, p_type, p_heard)) $$;
-- A hacker's draft with this heard_about (SQL literal).
create function pg_temp.hacker(p_user uuid, p_event uuid, p_heard text) returns text language sql as $$
  select pg_temp.as_req(p_user, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name, heard_about) values (%L, %L, 'hacker', 'draft', 'Hal', %s)$q$,
    p_user, p_event, p_heard)) $$;
-- Deletes that user's application, so one user can try several.
create function pg_temp.clear(p_user uuid) returns void language sql as $$ delete from public.applications where user_id = p_user $$;

\set ev '00000000-0000-0000-0000-00000000e301'
\set judge '''77777777-0000-0000-0000-000000000001'''
\set mentor '''77777777-0000-0000-0000-000000000002'''
\set hk '''77777777-0000-0000-0000-000000000003'''
\set try '''77777777-0000-0000-0000-000000000004'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'Staff Test', 'STFT', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:judge, 'judge@example.com', now()), (:mentor, 'mentor@example.com', now()),
  (:hk, 'hk@example.com', now()), (:try, 'try@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;


-- 1. Mentors and judges: the staff form's options --------------------------------

select pg_temp.expect('a sponsor''s judge says how they heard',
  pg_temp.staff(:judge, :'ev', 'judge', $$array['DataHacks Industry Sponsor', 'MLH email']$$), 'ok');
select pg_temp.expect('and reads it back',
  pg_temp.val_as(:judge, 'authenticated', $$select array_to_string(heard_about, ', ') from applications$$),
  'DataHacks Industry Sponsor, MLH email');
select pg_temp.expect('a mentor too, apostrophe and all',
  pg_temp.staff(:mentor, :'ev', 'mentor', $$array['UCSD''s The Basement', 'AI/Online Search', 'Other']$$), 'ok');
select pg_temp.expect('every staff option is accepted from a mentor & judge',
  pg_temp.staff(:try, :'ev', 'hybrid', $$array['MLH email', 'DataHacks Direct Reach-Out', 'UCSD''s The Basement', 'DataHacks Industry Sponsor',
    'Association with UCSD', 'IEEE Member', 'Word of Mouth', 'AI/Online Search', 'Other']$$), 'ok');
select pg_temp.clear(:try);
select pg_temp.expect('staff applications from before the question have none, which is still fine',
  pg_temp.staff(:try, :'ev', 'judge', 'null'), 'ok');
select pg_temp.clear(:try);
select pg_temp.expect('a hacker option isn''t accepted from staff',
  pg_temp.staff(:try, :'ev', 'mentor', $$array['Instagram']$$), '23514: %application_heard_about_check%');
select pg_temp.expect('nor a made-up one',
  pg_temp.staff(:try, :'ev', 'judge', $$array['Billboard']$$), '23514: %application_heard_about_check%');


-- 2. Hackers: unchanged ------------------------------------------------------------

select pg_temp.expect('hackers keep their options',
  pg_temp.hacker(:hk, :'ev', $$array['Instagram', 'Major League Hacking (MLH)', 'Other']$$), 'ok');
select pg_temp.clear(:hk);
select pg_temp.expect('and can''t pick a staff one',
  pg_temp.hacker(:hk, :'ev', $$array['IEEE Member']$$), '23514: %application_heard_about_check%');
