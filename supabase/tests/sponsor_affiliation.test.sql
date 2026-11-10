-- The sponsor a judge is judging for: optional, readable by the applicant,
-- and held to the short-answer rule (migration *_sponsor_affiliation.sql).
-- Run with supabase/tests/run.sh.
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
-- A judge application as the form sends it, by that user, with this sponsor (SQL literal).
create function pg_temp.judge(p_user uuid, p_event uuid, p_sponsor text) returns text language sql as $$
  select pg_temp.as_req(p_user, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title, linkedin_url,
         ucsd_affiliation, judging_track, acknowledged_in_person_judging, acknowledged_in_person, sponsor_affiliation)
       values (%L, %L, 'judge', 'submitted', 'Jo', 'Databricks', 'Engineer', 'https://linkedin.com/in/x', 'none', 'finance', true, true, %s)$q$,
    p_user, p_event, p_sponsor)) $$;

\set ev '00000000-0000-0000-0000-00000000e301'
\set judge '''77777777-0000-0000-0000-000000000001'''
\set plain '''77777777-0000-0000-0000-000000000002'''
\set mentor '''77777777-0000-0000-0000-000000000003'''
\set bad '''77777777-0000-0000-0000-000000000004'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'Sponsor Test', 'SPNT', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:judge, 'judge@example.com', now()), (:plain, 'plain@example.com', now()),
  (:mentor, 'mentor@example.com', now()), (:bad, 'bad@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;


select pg_temp.expect('applicants can read the column',
  (select (has_column_privilege('authenticated', 'public.applications', 'sponsor_affiliation', 'SELECT')
       and has_column_privilege('anon', 'public.applications', 'sponsor_affiliation', 'SELECT'))::text), 'true');

select pg_temp.expect('a judge sent by a sponsor names it', pg_temp.judge(:judge, :'ev', '''Databricks'''), 'ok');
select pg_temp.expect('and reads it back on their own application',
  pg_temp.val_as(:judge, 'authenticated', 'select sponsor_affiliation from applications'), 'Databricks');

select pg_temp.expect('a judge can leave it out', pg_temp.judge(:plain, :'ev', 'null'), 'ok');
select pg_temp.expect('a mentor never sends it',
  pg_temp.as_req(:mentor, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring)
    values (%L, %L, 'mentor', 'submitted', 'Mo', 'Org', 'Eng', 'https://linkedin.com/in/x', 'none', true)$q$, :mentor, :'ev')), 'ok');
select pg_temp.expect('both saved as null',
  (select string_agg(coalesce(sponsor_affiliation, 'null'), ',') from applications where user_id in (:plain, :mentor)), 'null,null');

select pg_temp.expect('200 characters is the cap',
  pg_temp.judge(:bad, :'ev', quote_literal(repeat('x', 201))), '23514: %application_sponsor_affiliation_check%');
select pg_temp.expect('no line breaks or tabs',
  pg_temp.judge(:bad, :'ev', quote_literal('Data' || chr(10) || 'bricks')), '23514: %application_sponsor_affiliation_check%');
select pg_temp.expect('200 characters fits', pg_temp.judge(:bad, :'ev', quote_literal(repeat('x', 200))), 'ok');
