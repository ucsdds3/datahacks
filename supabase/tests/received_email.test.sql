-- "We've received your application" emails: who can set received_emailed_at,
-- one claim per application, the daily limit, and the backfill for earlier
-- applicants (migration *_received_email.sql). Run with supabase/tests/run.sh.
\set ON_ERROR_STOP on

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

\set ev '00000000-0000-0000-0000-00000000e201'
\set org '''66666666-0000-0000-0000-000000000001'''
\set hk '''66666666-0000-0000-0000-000000000002'''
\set mentor '''66666666-0000-0000-0000-000000000003'''
\set drafter '''66666666-0000-0000-0000-000000000004'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'Received Test', 'RCVT', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:org, 'org@example.com', now()), (:hk, 'hk@example.com', now()),
  (:mentor, 'mentor@example.com', now()), (:drafter, 'drafter@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;
insert into public.event_roles (event_id, user_id, role) values (:'ev', :org, 'organizer');

-- As the edge functions call them (service role).
create function pg_temp.claim(p_user uuid) returns text language sql as $$
  select pg_temp.val_as(null, 'service_role', format('select claim_email(%L, %L, %L, %L)',
    '00000000-0000-0000-0000-00000000e201', 'received',
    'received:' || (select id from public.applications where user_id = p_user), (select id from public.applications where user_id = p_user))) $$;
create function pg_temp.finish(p_user uuid, p_ok boolean) returns text language sql as $$
  select pg_temp.as_req(null, 'service_role', format('select finish_email(%L, %L, %L)',
    'received:' || (select id from public.applications where user_id = p_user), p_ok, case when p_ok then null else 'SMTP 421 try later' end)) $$;
create function pg_temp.emailed(p_user uuid) returns text language sql as $$
  select coalesce((received_emailed_at is not null)::text, 'none') from public.applications where user_id = p_user $$;


-- 1. Nobody sets it through the API -------------------------------------------

select pg_temp.expect('applicants can read the column',
  (select (has_column_privilege('authenticated', 'public.applications', 'received_emailed_at', 'SELECT')
       and has_column_privilege('anon', 'public.applications', 'received_emailed_at', 'SELECT'))::text), 'true');

select pg_temp.expect('a hacker applies, claiming they were already emailed',
  pg_temp.as_req(:hk, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name, received_emailed_at)
    values (%L, %L, 'hacker', 'submitted', 'Hal', '2026-01-01')$q$, :hk, :'ev')), 'ok');
select pg_temp.expect('the insert''s received_emailed_at is ignored', pg_temp.emailed(:hk), 'false');

select pg_temp.expect('a mentor applies',
  pg_temp.as_req(:mentor, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring)
    values (%L, %L, 'mentor', 'submitted', 'Mo', 'Org', 'Eng', 'https://linkedin.com/in/x', 'none', true)$q$, :mentor, :'ev')), 'ok');

select pg_temp.expect('someone saves a draft',
  pg_temp.as_req(:drafter, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name) values (%L, %L, 'hacker', 'draft', 'Di')$q$, :drafter, :'ev')), 'ok');
select pg_temp.expect('their update to the draft can''t set it',
  pg_temp.as_req(:drafter, 'authenticated', format($q$update applications set received_emailed_at = now(), first_name = 'Dee' where user_id = %L$q$, :drafter)), 'ok');
select pg_temp.expect('draft updated, received_emailed_at still empty',
  (select first_name || '/' || coalesce(received_emailed_at::text, 'null') from applications where user_id = :drafter), 'Dee/null');

select pg_temp.expect('an organizer''s update can''t set it either',
  pg_temp.as_req(:org, 'authenticated', format($q$update applications set received_emailed_at = now() where user_id = %L$q$, :hk)), 'ok');
select pg_temp.expect('still not emailed', pg_temp.emailed(:hk), 'false');

select pg_temp.expect('applicants can''t claim emails themselves',
  pg_temp.as_req(:hk, 'authenticated', format($q$select claim_email(%L, 'received', 'received:x', null)$q$, :'ev')), '42501: %');
select pg_temp.expect('or mark them sent',
  pg_temp.as_req(:hk, 'authenticated', $q$select finish_email('received:x', true)$q$), '42501: %');


-- 2. One email per application -------------------------------------------------

select pg_temp.expect('first claim', pg_temp.claim(:hk), 'claimed');
select pg_temp.expect('a second request while it''s sending (another tab, a double click) is busy', pg_temp.claim(:hk), 'busy');
select pg_temp.expect('finish ok', pg_temp.finish(:hk, true), 'ok');
select pg_temp.expect('received_emailed_at set straight away', pg_temp.emailed(:hk), 'true');
select pg_temp.expect('the applicant can see it was sent (the portal''s fallback reads this)',
  pg_temp.val_as(:hk, 'authenticated', format($q$select (received_emailed_at is not null)::text from applications where user_id = %L$q$, :hk)), 'true');
select pg_temp.expect('a retry finds it sent', pg_temp.claim(:hk), 'sent');
select pg_temp.expect('one email_log row, kind received',
  (select count(*)::text || '/' || min(kind) || '/' || min(status) from email_log where dedupe_key like 'received:%'), '1/received/sent');

-- A failed send frees the key for the next try; nothing is marked.
select pg_temp.expect('mentor claim', pg_temp.claim(:mentor), 'claimed');
select pg_temp.expect('Gmail failed', pg_temp.finish(:mentor, false), 'ok');
select pg_temp.expect('not marked as emailed', pg_temp.emailed(:mentor), 'false');
select pg_temp.expect('the next try can claim it again', pg_temp.claim(:mentor), 'claimed');
select pg_temp.finish(:mentor, true);
select pg_temp.expect('and it''s marked once sent', pg_temp.emailed(:mentor), 'true');

-- Marked by hand (SQL editor): counts as sent, with no log row.
update applications set received_emailed_at = now() where user_id = :drafter;
select pg_temp.expect('an application already marked counts as sent', pg_temp.claim(:drafter), 'sent');
select pg_temp.expect('no claim was made for it', (select count(*)::text from email_log where application_id = (select id from applications where user_id = :drafter)), '0');

-- Other kinds behave as before.
select pg_temp.expect('a decision claim still works',
  pg_temp.val_as(null, 'service_role', format($q$select claim_email(%L, 'decision', 'decision:x:1', (select id from applications where user_id = %L))$q$, :'ev', :hk)), 'claimed');
select pg_temp.expect('an unknown kind is still refused',
  pg_temp.as_req(null, 'service_role', format($q$select claim_email(%L, 'spam', 'spam:x', null)$q$, :'ev')), '23514: %');


-- 3. The daily limit counts these too ---------------------------------------------

select pg_temp.expect('received emails count towards the day''s sends', (select email_sends_last_day()::text), '3');
insert into email_log (event_id, kind, dedupe_key, status, claimed_at)
select :'ev', 'blast', 'filler:' || n, 'sent', now() - interval '1 hour' from generate_series(1, 1797) n;
update applications set received_emailed_at = null where user_id = :drafter;
select pg_temp.expect('at the limit, a received email waits', pg_temp.claim(:drafter), 'quota');
delete from email_log where dedupe_key like 'filler:%';


-- 4. The backfill: applications from before this existed aren't due ------------------

\set old '''66666666-0000-0000-0000-000000000010'''
\set recent '''66666666-0000-0000-0000-000000000011'''
\set olddraft '''66666666-0000-0000-0000-000000000012'''
\set olddecided '''66666666-0000-0000-0000-000000000013'''
insert into auth.users (id, email, email_confirmed_at) values
  (:old, 'old@example.com', now()), (:recent, 'recent@example.com', now()),
  (:olddraft, 'olddraft@example.com', now()), (:olddecided, 'olddecided@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users where id in (:old, :recent, :olddraft, :olddecided);
insert into applications (user_id, event_id, applicant_type, status, first_name, email, submitted_at) values
  (:old, :'ev', 'hacker', 'submitted', 'Old', 'old@example.com', now() - interval '3 days'),
  (:recent, :'ev', 'hacker', 'submitted', 'New', 'recent@example.com', now() - interval '2 hours'),
  (:olddraft, :'ev', 'hacker', 'draft', 'Dr', 'olddraft@example.com', null),
  (:olddecided, :'ev', 'hacker', 'rejected', 'Re', 'olddecided@example.com', now() - interval '3 days');
update applications set created_at = now() - interval '3 days' where user_id = :olddraft;
create temp table before_backfill as select user_id, received_emailed_at from applications where user_id in (:hk, :mentor);

-- The migration again, as it runs on a database that already has applications.
set client_min_messages = warning;
\ir ../migrations/20261109234804_received_email.sql
reset client_min_messages;

select pg_temp.expect('a submitted application from days ago is marked as not needing it', pg_temp.emailed(:old), 'true');
select pg_temp.expect('without an email_log row', (select count(*)::text from email_log where dedupe_key = 'received:' || (select id from applications where user_id = :old)), '0');
select pg_temp.expect('so the function finds it sent', pg_temp.claim(:old), 'sent');
select pg_temp.expect('the last day''s applicant is still due', pg_temp.emailed(:recent), 'false');
select pg_temp.expect('and can be emailed', pg_temp.claim(:recent), 'claimed');
select pg_temp.expect('drafts are left alone', pg_temp.emailed(:olddraft), 'false');
select pg_temp.expect('decided applications are left alone', pg_temp.emailed(:olddecided), 'false');
select pg_temp.expect('people already emailed keep their time',
  (select count(*)::text from applications a join before_backfill b using (user_id) where a.received_emailed_at = b.received_emailed_at), '2');
select pg_temp.expect('the kind check was replaced, not duplicated',
  (select count(*)::text from pg_constraint where conrelid = 'public.email_log'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '\mkind\M'), '1');
