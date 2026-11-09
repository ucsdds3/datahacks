-- MLH consent: the per-event switch, who can set the checkboxes, server
-- timestamps and the existing-applicant RPC (migration *_mlh_consent.sql).
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
-- The consent on a user's application: coc/data/emails as t/f, then which timestamps are set.
create function pg_temp.consent(p_user uuid) returns text language sql as $$
  select concat_ws('/', mlh_code_of_conduct::text, mlh_data_sharing::text, mlh_emails_opt_in::text,
                   (mlh_code_of_conduct_at is not null)::text, (mlh_data_sharing_at is not null)::text, (mlh_emails_opt_in_at is not null)::text)
    from public.applications where user_id = p_user $$;
-- A minimal hacker application as an API insert by that user.
create function pg_temp.apply(p_user uuid, p_event uuid, p_status text, p_extra text default '') returns text language sql as $$
  select pg_temp.as_req(p_user, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name %s) values (%L, %L, 'hacker', %L, 'Hal' %s)$q$,
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '|', 1) end,
    p_user, p_event, p_status,
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '|', 2) end)) $$;

\set ev '00000000-0000-0000-0000-00000000e001'
\set org '''55555555-0000-0000-0000-000000000001'''
\set early '''55555555-0000-0000-0000-000000000002'''
\set late '''55555555-0000-0000-0000-000000000003'''
\set agreer '''55555555-0000-0000-0000-000000000004'''
\set drafter '''55555555-0000-0000-0000-000000000005'''
\set mentor '''55555555-0000-0000-0000-000000000006'''
\set nobody '''55555555-0000-0000-0000-000000000007'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'MLH Test', 'MLHT', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:org, 'org@example.com', now()), (:early, 'early@example.com', now()), (:late, 'late@example.com', now()),
  (:agreer, 'agreer@example.com', now()), (:drafter, 'drafter@example.com', now()),
  (:mentor, 'mentor@example.com', now()), (:nobody, 'nobody@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;
insert into public.event_roles (event_id, user_id, role) values (:'ev', :org, 'organizer');


-- 1. Columns and privileges ---------------------------------------------------

select pg_temp.expect('events.mlh_required is off by default', (select mlh_required::text from events where id = :'ev'), 'false');
select pg_temp.expect('applicants can read their consent columns',
  (select string_agg(c, ',' order by c) from unnest(array['mlh_code_of_conduct', 'mlh_code_of_conduct_at', 'mlh_data_sharing',
     'mlh_data_sharing_at', 'mlh_emails_opt_in', 'mlh_emails_opt_in_at']) c
    where has_column_privilege('authenticated', 'public.applications', c, 'SELECT')
      and has_column_privilege('anon', 'public.applications', c, 'SELECT')),
  'mlh_code_of_conduct,mlh_code_of_conduct_at,mlh_data_sharing,mlh_data_sharing_at,mlh_emails_opt_in,mlh_emails_opt_in_at');
select pg_temp.expect('the review columns are still the only unreadable ones',
  (select string_agg(attname, ',' order by attname) from pg_attribute
    where attrelid = 'public.applications'::regclass and attnum > 0 and not attisdropped
      and not has_column_privilege('authenticated', 'public.applications', attname, 'SELECT')),
  'decided_at,decided_by,decision,decision_version');
select pg_temp.expect('an applicant can''t turn the switch on (no update policy on events)',
  pg_temp.val_as(:early, 'authenticated', format($q$with u as (update events set mlh_required = true where id = %L returning 1) select count(*)::text from u$q$, :'ev')), '0');
select pg_temp.expect('anon can''t call agree_to_mlh',
  pg_temp.as_req(null, 'anon', format($q$select agree_to_mlh(%L, true)$q$, :'ev')), '42501: %');


-- 2. Switch off: nothing required ----------------------------------------------

select pg_temp.expect('switch off: a hacker applies without ticking anything', pg_temp.apply(:early, :'ev', 'submitted'), 'ok');
select pg_temp.expect('nothing agreed, no timestamps', pg_temp.consent(:early), 'false/false/false/false/false/false');


-- 3. Switch on: required for new hacker submissions -----------------------------

update events set mlh_required = true where id = :'ev';

select pg_temp.expect('switch on: refused without the MLH checkboxes', pg_temp.apply(:late, :'ev', 'submitted'), '23514: To apply, agree to the MLH Code of Conduct%');
select pg_temp.expect('refused with only the Code of Conduct',
  pg_temp.apply(:late, :'ev', 'submitted', 'mlh_code_of_conduct|true'), '23514: %MLH%');
select pg_temp.expect('refused with only data sharing',
  pg_temp.apply(:late, :'ev', 'submitted', 'mlh_data_sharing|true'), '23514: %MLH%');
select pg_temp.expect('accepted with both required, backdated timestamps sent',
  pg_temp.apply(:late, :'ev', 'submitted',
    'mlh_code_of_conduct, mlh_data_sharing, mlh_code_of_conduct_at, mlh_data_sharing_at, mlh_emails_opt_in_at|true, true, ''2000-01-01'', ''2000-01-01'', ''2000-01-01'''), 'ok');
select pg_temp.expect('both agreed, emails not, and no emails timestamp', pg_temp.consent(:late), 'true/true/false/true/true/false');
select pg_temp.expect('the timestamps are the server''s, not the backdated ones',
  (select (mlh_code_of_conduct_at > now() - interval '1 minute' and mlh_data_sharing_at > now() - interval '1 minute')::text
     from applications where user_id = :late), 'true');

select pg_temp.expect('a mentor application doesn''t need the MLH checkboxes',
  pg_temp.as_req(:mentor, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring)
    values (%L, %L, 'mentor', 'submitted', 'Mo', 'Org', 'Eng', 'https://linkedin.com/in/x', 'none', true)$q$, :mentor, :'ev')), 'ok');

-- A draft can be saved without them; submitting it can't.
select pg_temp.expect('a draft saves without the checkboxes', pg_temp.apply(:drafter, :'ev', 'draft'), 'ok');
select pg_temp.expect('submitting the draft without them is refused',
  pg_temp.as_req(:drafter, 'authenticated', format($q$update applications set status = 'submitted' where user_id = %L$q$, :drafter)), '23514: %MLH%');
select pg_temp.expect('ticking them on the draft (and the emails)',
  pg_temp.as_req(:drafter, 'authenticated', format($q$update applications set mlh_code_of_conduct = true, mlh_data_sharing = true, mlh_emails_opt_in = true where user_id = %L$q$, :drafter)), 'ok');
select pg_temp.expect('then submitting it works',
  pg_temp.as_req(:drafter, 'authenticated', format($q$update applications set status = 'submitted' where user_id = %L$q$, :drafter)), 'ok');
select pg_temp.expect('all three agreed with timestamps', pg_temp.consent(:drafter), 'true/true/true/true/true/true');


-- 4. People who applied before the switch -------------------------------------

select pg_temp.expect('an organizer can still decide on an early applicant',
  pg_temp.as_req(:org, 'authenticated', format($q$select stage_decisions(%L, array[(select id from applications where user_id = %L)], 'accepted')$q$, :'ev', :early)), 'ok');
select pg_temp.expect('and release it',
  pg_temp.as_req(:org, 'authenticated', format($q$select release_decisions(%L)$q$, :'ev')), 'ok');
select pg_temp.expect('the early applicant is accepted without MLH consent', (select status from applications where user_id = :early), 'accepted');

select pg_temp.expect('an organizer can''t tick the boxes for an applicant',
  pg_temp.as_req(:org, 'authenticated', format($q$update applications set mlh_code_of_conduct = true, mlh_data_sharing = true, mlh_emails_opt_in = true where user_id = %L$q$, :early)), 'ok');
select pg_temp.expect('still not agreed', pg_temp.consent(:early), 'false/false/false/false/false/false');
select pg_temp.expect('an organizer can''t un-tick an applicant''s agreement either',
  pg_temp.as_req(:org, 'authenticated', format($q$update applications set mlh_data_sharing = false where user_id = %L$q$, :late)), 'ok');
select pg_temp.expect('still agreed', pg_temp.consent(:late), 'true/true/false/true/true/false');

select pg_temp.expect('the applicant can''t update their submitted row directly (row-level security: no rows)',
  pg_temp.val_as(:early, 'authenticated', format($q$with u as (update applications set mlh_code_of_conduct = true where user_id = %L returning 1) select count(*)::text from u$q$, :early)), '0');

select pg_temp.expect('agree_to_mlh records the early applicant''s agreement',
  pg_temp.val_as(:early, 'authenticated', format($q$select (r ->> 'mlh_emails_opt_in') || '/' || (r ->> 'mlh_code_of_conduct_at' is not null) from agree_to_mlh(%L, true) r$q$, :'ev')), 'true/true');
select pg_temp.expect('saved on their row', pg_temp.consent(:early), 'true/true/true/true/true/true');
update applications set mlh_code_of_conduct_at = '2027-01-01T12:00:00Z' where user_id = :early;
select pg_temp.expect('calling it again to opt out of emails',
  pg_temp.as_req(:early, 'authenticated', format($q$select agree_to_mlh(%L, false)$q$, :'ev')), 'ok');
select pg_temp.expect('emails off and their timestamp cleared, the rest kept', pg_temp.consent(:early), 'true/true/false/true/true/false');
select pg_temp.expect('the first agreement''s time is kept', (select mlh_code_of_conduct_at::date::text from applications where user_id = :early), '2027-01-01');
select pg_temp.expect('the early applicant''s status is untouched', (select status from applications where user_id = :early), 'accepted');

select pg_temp.expect('agree_to_mlh needs a hacker application',
  pg_temp.as_req(:mentor, 'authenticated', format($q$select agree_to_mlh(%L, true)$q$, :'ev')), 'P0001: You don''t have a hacker application%');
select pg_temp.expect('or any application',
  pg_temp.as_req(:nobody, 'authenticated', format($q$select agree_to_mlh(%L)$q$, :'ev')), 'P0001: You don''t have a hacker application%');
select pg_temp.expect('a signed-out request is refused',
  pg_temp.as_req(null, 'authenticated', format($q$select agree_to_mlh(%L)$q$, :'ev')), 'P0001: Sign in first.');


-- 5. The SQL editor can still fix data by hand ----------------------------------

update applications set mlh_emails_opt_in = true, mlh_emails_opt_in_at = '2026-12-01T12:00:00Z' where user_id = :early;
select pg_temp.expect('a hand fix keeps the timestamp it was given', (select mlh_emails_opt_in_at::date::text from applications where user_id = :early), '2026-12-01');
insert into applications (user_id, event_id, applicant_type, status, first_name, mlh_code_of_conduct, mlh_data_sharing)
  values (:agreer, :'ev', 'hacker', 'submitted', 'Ag', true, true);
select pg_temp.expect('a hand insert gets timestamps filled in', pg_temp.consent(:agreer), 'true/true/false/true/true/false');
select pg_temp.expect('a hand insert without consent is refused while the switch is on',
  (select pg_temp.as_req(null, 'service_role', format($q$insert into applications (event_id, applicant_type, status, first_name) values (%L, 'hacker', 'submitted', 'X')$q$, :'ev'))),
  '23514: %MLH%');

-- Switch back off: new hacker applications don't need it again.
update events set mlh_required = false where id = :'ev';
delete from applications where user_id = :agreer;
select pg_temp.expect('switch off again: applying without the checkboxes works', pg_temp.apply(:agreer, :'ev', 'submitted'), 'ok');
