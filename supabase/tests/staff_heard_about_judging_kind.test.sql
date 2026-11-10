-- Mentor/judge applications: their own "how did you hear" options, and what a
-- judge will judge, a sponsor challenge or a track (migration
-- *_staff_heard_about_judging_kind.sql). Run with supabase/tests/run.sh.
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
-- A staff application as the forms send it, by that user: type, heard_about and judging_kind as SQL literals.
create function pg_temp.staff(p_user uuid, p_event uuid, p_type text, p_heard text, p_kind text) returns text language sql as $$
  select pg_temp.as_req(p_user, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title, linkedin_url,
         ucsd_affiliation, judging_track, acknowledged_in_person_judging, acknowledged_onsite_mentoring, acknowledged_in_person,
         heard_about, judging_kind)
       values (%L, %L, %L, 'submitted', 'Jo', 'Databricks', 'Engineer', 'https://linkedin.com/in/x', 'none',
         case when %L = 'mentor' then null else 'finance' end, %L <> 'mentor', %L <> 'judge', true, %s, %s)$q$,
    p_user, p_event, p_type, p_type, p_type, p_type, p_heard, p_kind)) $$;
-- A hacker's draft with this heard_about (SQL literal).
create function pg_temp.hacker(p_user uuid, p_event uuid, p_heard text) returns text language sql as $$
  select pg_temp.as_req(p_user, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name, heard_about) values (%L, %L, 'hacker', 'draft', 'Hal', %s)$q$,
    p_user, p_event, p_heard)) $$;
-- Deletes that user's application, so one user can try several.
create function pg_temp.clear(p_user uuid) returns void language sql as $$ delete from public.applications where user_id = p_user $$;

\set ev '00000000-0000-0000-0000-00000000e301'
\set judge '''77777777-0000-0000-0000-000000000001'''
\set hybrid '''77777777-0000-0000-0000-000000000002'''
\set mentor '''77777777-0000-0000-0000-000000000003'''
\set hk '''77777777-0000-0000-0000-000000000004'''
\set try '''77777777-0000-0000-0000-000000000005'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'Staff Test', 'STFT', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:judge, 'judge@example.com', now()), (:hybrid, 'hybrid@example.com', now()),
  (:mentor, 'mentor@example.com', now()), (:hk, 'hk@example.com', now()), (:try, 'try@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;


-- 1. judging_kind --------------------------------------------------------------

select pg_temp.expect('applicants can read judging_kind',
  (select (has_column_privilege('authenticated', 'public.applications', 'judging_kind', 'SELECT')
       and has_column_privilege('anon', 'public.applications', 'judging_kind', 'SELECT'))::text), 'true');

select pg_temp.expect('a sponsor''s judge applies to judge its challenge',
  pg_temp.staff(:judge, :'ev', 'judge', $$array['DataHacks Industry Sponsor', 'MLH email']$$, $$'challenge'$$), 'ok');
select pg_temp.expect('and reads both answers back',
  pg_temp.val_as(:judge, 'authenticated', $$select judging_kind || ' / ' || array_to_string(heard_about, ', ') from applications$$),
  'challenge / DataHacks Industry Sponsor, MLH email');
select pg_temp.expect('a mentor & judge applies to judge a track',
  pg_temp.staff(:hybrid, :'ev', 'hybrid', $$array['Word of Mouth']$$, $$'track'$$), 'ok');
select pg_temp.expect('a mentor applies with neither kind',
  pg_temp.staff(:mentor, :'ev', 'mentor', $$array['UCSD''s The Basement', 'AI/Online Search', 'Other']$$, 'null'), 'ok');
select pg_temp.expect('the mentor has no judging_kind', (select coalesce(judging_kind, 'null') from applications where user_id = :mentor), 'null');

select pg_temp.expect('a judge can leave it out (older rows have none)',
  pg_temp.staff(:try, :'ev', 'judge', 'null', 'null'), 'ok');
select pg_temp.clear(:try);
select pg_temp.expect('a mentor can''t have one',
  pg_temp.staff(:try, :'ev', 'mentor', 'null', $$'track'$$), '23514: %application_judging_kind_check%');
select pg_temp.expect('only challenge or track',
  pg_temp.staff(:try, :'ev', 'judge', 'null', $$'sponsor'$$), '23514: %application_judging_kind_check%');


-- 2. heard_about: each form's own options ----------------------------------------

select pg_temp.expect('every staff option is accepted from staff',
  pg_temp.staff(:try, :'ev', 'hybrid', $$array['MLH email', 'DataHacks Direct Reach-Out', 'UCSD''s The Basement', 'DataHacks Industry Sponsor',
    'Association with UCSD', 'IEEE Member', 'Word of Mouth', 'AI/Online Search', 'Other']$$, $$'track'$$), 'ok');
select pg_temp.clear(:try);
select pg_temp.expect('a hacker option isn''t, from staff',
  pg_temp.staff(:try, :'ev', 'mentor', $$array['Instagram']$$, 'null'), '23514: %application_heard_about_check%');
select pg_temp.expect('a made-up one isn''t',
  pg_temp.staff(:try, :'ev', 'judge', $$array['Billboard']$$, $$'track'$$), '23514: %application_heard_about_check%');

select pg_temp.expect('hackers keep their options',
  pg_temp.hacker(:hk, :'ev', $$array['Instagram', 'Major League Hacking (MLH)', 'Other']$$), 'ok');
select pg_temp.clear(:hk);
select pg_temp.expect('and can''t pick a staff one',
  pg_temp.hacker(:hk, :'ev', $$array['IEEE Member']$$), '23514: %application_heard_about_check%');
