-- Decisions hidden until release, the decision audit trail, applicant-owned
-- fields, OAuth-client tokens and the last organizer
-- (migration *_decisions_private.sql). Run with supabase/tests/run.sh.
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
  select pg_temp.as_claims(jsonb_build_object('sub', p_sub), p_role, p_sql) $$;
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
  select pg_temp.val_claims(jsonb_build_object('sub', p_sub), p_role, p_sql) $$;
create function pg_temp.expect(label text, got text, want text) returns void language plpgsql as $$
begin
  if got like want then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %: got [%], want [%]', label, got, want; end if;
end $$;

\set ev '00000000-0000-0000-0000-00000000d001'
\set other '00000000-0000-0000-0000-00000000d002'
\set org1 '''44444444-0000-0000-0000-000000000001'''
\set org2 '''44444444-0000-0000-0000-000000000002'''
\set hacker '''44444444-0000-0000-0000-000000000003'''
\set victim '''44444444-0000-0000-0000-000000000004'''
\set drafter '''44444444-0000-0000-0000-000000000005'''
\set h2 '''44444444-0000-0000-0000-000000000006'''
\set orgother '''44444444-0000-0000-0000-000000000007'''

insert into public.events (id, name, code, applications_open) values
  (:'ev', 'Decisions Test', 'DPT', true),
  (:'other', 'Other', 'DPO', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:org1, 'org1@example.com', now()),
  (:org2, 'org2@example.com', now()),
  (:hacker, 'hacker@example.com', now()),
  (:victim, 'victim@example.com', now()),
  (:drafter, 'drafter@example.com', now()),
  (:h2, 'h2@example.com', now()),
  (:orgother, 'orgother@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;
insert into public.event_roles (event_id, user_id, role) values
  (:'ev', :org1, 'organizer'), (:'ev', :org2, 'organizer'), (:'other', :orgother, 'organizer');

create function pg_temp.app(p_user uuid) returns uuid language sql as $$
  select id from public.applications where user_id = p_user $$;


-- 1. Applicant-owned fields (security 6 and 8) --------------------------------

select pg_temp.expect('hacker submits with a backdated submitted_at and someone else''s email',
  pg_temp.as_req(:hacker, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, submitted_at, created_at, email, first_name)
    values (%L, %L, 'hacker', 'submitted', '2000-01-01', '2000-01-01', 'victim@example.com', 'Hal')$q$, :hacker, :'ev')), 'ok');
select pg_temp.expect('email forced to the sign-in email', (select email from applications where user_id = :hacker), 'hacker@example.com');
select pg_temp.expect('submitted_at set by the server', (select (submitted_at > now() - interval '1 minute')::text from applications where user_id = :hacker), 'true');
select pg_temp.expect('created_at set by the server', (select (created_at > now() - interval '1 minute')::text from applications where user_id = :hacker), 'true');

select pg_temp.expect('mentor application under someone else''s email',
  pg_temp.as_req(:h2, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, email, first_name, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring)
    values (%L, %L, 'mentor', 'submitted', 'Victim@Example.com', 'Mo', 'Org', 'Eng', 'https://linkedin.com/in/x', 'none', true)$q$, :h2, :'ev')), 'ok');
select pg_temp.expect('staff email forced to the sign-in email', (select email from applications where user_id = :h2), 'h2@example.com');
select pg_temp.expect('the real owner of that address can still apply',
  pg_temp.as_req(:victim, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, email, first_name, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring)
    values (%L, %L, 'mentor', 'submitted', 'victim@example.com', 'Vi', 'Org', 'Eng', 'https://linkedin.com/in/v', 'none', true)$q$, :victim, :'ev')), 'ok');

-- A draft, then submitting it later.
select pg_temp.expect('drafter saves a draft with a submitted_at',
  pg_temp.as_req(:drafter, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, submitted_at, first_name)
    values (%L, %L, 'hacker', 'draft', '2000-01-01', 'Dee')$q$, :drafter, :'ev')), 'ok');
select pg_temp.expect('a draft has no submitted_at', (select coalesce(submitted_at::text, 'null') from applications where user_id = :drafter), 'null');
select pg_temp.expect('drafter tries to backdate and change email on the draft',
  pg_temp.as_req(:drafter, 'authenticated', format($q$update applications set submitted_at = '2000-01-01', created_at = '2000-01-01', email = 'victim@example.com' where user_id = %L$q$, :drafter)), 'ok');
select pg_temp.expect('draft unchanged: no submitted_at, own email, created_at kept',
  (select coalesce(submitted_at::text, 'null') || '/' || email || '/' || (created_at > '2001-01-01')::text from applications where user_id = :drafter),
  'null/drafter@example.com/true');

-- An organizer can still fix a row by hand (and the SQL editor too).
select pg_temp.expect('organizer can correct an email',
  pg_temp.as_req(:org1, 'authenticated', format($q$update applications set email = 'hal.work@example.com' where user_id = %L$q$, :hacker)), 'ok');
select pg_temp.expect('organizer''s correction kept', (select email from applications where user_id = :hacker), 'hal.work@example.com');
update applications set email = 'hacker@example.com' where user_id = :hacker;


-- 2. Decisions are hidden from applicants until released (security 3) ---------

select pg_temp.expect('applicant can read their own status',
  pg_temp.val_as(:hacker, 'authenticated', format($q$select status from applications where user_id = %L$q$, :hacker)), 'submitted');
select pg_temp.expect('organizer stages a rejection',
  pg_temp.val_as(:org1, 'authenticated', format($q$select stage_decisions(%L, array[%L]::uuid[], 'rejected', array[0])::text$q$, :'ev', pg_temp.app(:hacker))),
  '%"updated": [{"id": "%", "version": 1}]%');
select pg_temp.expect('applicant cannot read decision',
  pg_temp.as_req(:hacker, 'authenticated', format($q$select decision from applications where user_id = %L$q$, :hacker)), '42501: %');
select pg_temp.expect('applicant cannot select * either',
  pg_temp.as_req(:hacker, 'authenticated', format($q$select * from applications where user_id = %L$q$, :hacker)), '42501: %');
select pg_temp.expect('applicant cannot read who decided',
  pg_temp.as_req(:hacker, 'authenticated', format($q$select decided_by, decided_at, decision_version from applications where user_id = %L$q$, :hacker)), '42501: %');
select pg_temp.expect('applicant cannot filter on decision (no side channel)',
  pg_temp.as_req(:hacker, 'authenticated', $q$select id from applications where decision = 'rejected'$q$), '42501: %');
select pg_temp.expect('applicant still sees "submitted" (portal shows under review)',
  pg_temp.val_as(:hacker, 'authenticated', format($q$select status from applications where user_id = %L$q$, :hacker)), 'submitted');
select pg_temp.expect('applicant cannot call staged_decisions',
  pg_temp.as_req(:hacker, 'authenticated', format($q$select staged_decisions(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('anon cannot read decisions',
  pg_temp.as_req(null, 'anon', $q$select decision from applications$q$), '42501: %');
-- Every other column is still readable, so the portal and the console's lists work.
select pg_temp.expect('authenticated can read every column except the review ones',
  (select string_agg(attname, ',' order by attname) from pg_attribute
    where attrelid = 'public.applications'::regclass and attnum > 0 and not attisdropped
      and not has_column_privilege('authenticated', 'public.applications', attname, 'SELECT')),
  'decided_at,decided_by,decision,decision_version');
select pg_temp.expect('the console''s list columns are readable by an organizer',
  pg_temp.as_req(:org1, 'authenticated', format($q$select id, applicant_type, status, submitted_at, first_name, last_name, email, phone, school, level_of_study, organization, decision_released_at, decision_emailed_at from applications where event_id = %L$q$, :'ev')), 'ok');
select pg_temp.expect('organizer reads decisions through staged_decisions',
  pg_temp.val_as(:org1, 'authenticated', format($q$select (s -> 0 ->> 'decision') || '/' || (s -> 0 ->> 'decided_by') || '/' || (s -> 0 ->> 'version') from staged_decisions(%L) s$q$, :'ev')),
  'rejected/org1@example.com/1');
select pg_temp.expect('an organizer of another event cannot',
  pg_temp.as_req(:orgother, 'authenticated', format($q$select staged_decisions(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('applicant cannot set decided_by or the version',
  pg_temp.as_req(:hacker, 'authenticated', format($q$update applications set decided_by = %L, decision_version = 99 where user_id = %L$q$, :hacker, :hacker)), 'ok');
select pg_temp.expect('audit columns unchanged', (select decided_by::text || '/' || decision_version from applications where user_id = :hacker),
  '44444444-0000-0000-0000-000000000001/1');


-- 3. Optimistic concurrency and the audit trail (organizer M1) ---------------

-- org1 and org2 both loaded the hacker at version 1. org2 accepts first; org1's reject is refused.
select pg_temp.expect('org2 accepts (saw version 1)',
  pg_temp.val_as(:org2, 'authenticated', format($q$select jsonb_array_length(stage_decisions(%L, array[%L]::uuid[], 'accepted', array[1]) -> 'updated')::text$q$, :'ev', pg_temp.app(:hacker))), '1');
select pg_temp.expect('decided_by is org2, version 2', (select decided_by::text || '/' || decision_version from applications where user_id = :hacker),
  '44444444-0000-0000-0000-000000000002/2');
select pg_temp.expect('org1''s stale reject comes back as a conflict naming org2',
  pg_temp.val_as(:org1, 'authenticated', format($q$select (r -> 'conflicts' -> 0 ->> 'decided_by') || '/' || (r -> 'conflicts' -> 0 ->> 'decision') || '/' || jsonb_array_length(r -> 'updated') from stage_decisions(%L, array[%L]::uuid[], 'rejected', array[1]) r$q$, :'ev', pg_temp.app(:hacker))),
  'org2@example.com/accepted/0');
select pg_temp.expect('the accept stands', (select decision from applications where user_id = :hacker), 'accepted');
select pg_temp.expect('same decision again is a no-op (version unchanged)',
  pg_temp.val_as(:org1, 'authenticated', format($q$select (stage_decisions(%L, array[%L]::uuid[], 'accepted', array[2]) -> 'updated' -> 0 ->> 'version')$q$, :'ev', pg_temp.app(:hacker))), '2');
select pg_temp.expect('a plain update also stamps the audit trail',
  pg_temp.as_req(:org1, 'authenticated', format($q$update applications set decision = 'waitlisted' where id = %L$q$, pg_temp.app(:hacker))), 'ok');
select pg_temp.expect('stamped org1, version 3', (select decided_by::text || '/' || decision_version || '/' || (decided_at is not null)::text from applications where user_id = :hacker),
  '44444444-0000-0000-0000-000000000001/3/true');
select pg_temp.expect('unknown decision refused',
  pg_temp.as_req(:org1, 'authenticated', format($q$select stage_decisions(%L, array[%L]::uuid[], 'maybe')$q$, :'ev', pg_temp.app(:hacker))), '22023: %');
select pg_temp.expect('another event''s application comes back missing',
  pg_temp.val_as(:org1, 'authenticated', format($q$select jsonb_array_length(stage_decisions(%L, array[gen_random_uuid()], 'accepted') -> 'missing')::text$q$, :'ev')), '1');
select pg_temp.expect('applicants cannot stage',
  pg_temp.as_req(:hacker, 'authenticated', format($q$select stage_decisions(%L, array[%L]::uuid[], 'accepted')$q$, :'ev', pg_temp.app(:hacker))), 'P0001: Not authorized');


-- 4. Drafts can't be decided or released (organizer H4) -----------------------

select pg_temp.expect('stage_decisions skips a draft',
  pg_temp.val_as(:org1, 'authenticated', format($q$select (stage_decisions(%L, array[%L]::uuid[], 'accepted') -> 'drafts' ->> 0)$q$, :'ev', pg_temp.app(:drafter))),
  (select id::text from applications where user_id = :drafter));
select pg_temp.expect('a direct update refuses a decision on a draft',
  pg_temp.as_req(:org1, 'authenticated', format($q$update applications set decision = 'accepted' where id = %L$q$, pg_temp.app(:drafter))), '23514: %submitted%');
-- A draft that got a decision before this migration (inserted directly) is never released.
alter table applications disable trigger applications_stamp_decision;
update applications set decision = 'accepted' where user_id = :drafter;
alter table applications enable trigger applications_stamp_decision;


-- 5. Releasing exactly what was shown (organizer H3) --------------------------

-- Staged now: hacker waitlisted (v3), h2 accepted, victim rejected; the draft has a stale decision.
select pg_temp.expect('stage h2 accepted and victim rejected',
  pg_temp.val_as(:org1, 'authenticated', format($q$select jsonb_array_length(r -> 'updated') || '/' || jsonb_array_length(stage_decisions(%L, array[%L]::uuid[], 'rejected') -> 'updated') from stage_decisions(%L, array[%L]::uuid[], 'accepted') r$q$,
    :'ev', pg_temp.app(:victim), :'ev', pg_temp.app(:h2))), '1/1');
-- org1's dialog shows hacker (v3) and h2 (v1). Meanwhile org2 changes h2 to rejected (v2).
select pg_temp.expect('org2 changes h2 while org1''s dialog is open',
  pg_temp.as_req(:org2, 'authenticated', format($q$select stage_decisions(%L, array[%L]::uuid[], 'rejected', array[1])$q$, :'ev', pg_temp.app(:h2))), 'ok');
update applications set decision_emailed_at = now() - interval '1 day' where user_id = :hacker;
select pg_temp.expect('release with ids and versions releases only the unchanged one',
  pg_temp.val_as(:org1, 'authenticated', format($q$select string_agg(application_id::text || '=' || status, ',') from release_decisions(%L, array[%L, %L]::uuid[], array[3, 1])$q$, :'ev', pg_temp.app(:hacker), pg_temp.app(:h2))),
  (select id::text || '=waitlisted' from applications where user_id = :hacker));
select pg_temp.expect('h2 not released (changed since), victim not released (not shown)',
  (select string_agg(status, ',' order by email) from applications where user_id in (:h2, :victim)), 'submitted,submitted');
select pg_temp.expect('released row counts as not emailed yet',
  (select coalesce(decision_emailed_at::text, 'null') || '/' || (decision_released_at is not null)::text from applications where user_id = :hacker), 'null/true');
select pg_temp.expect('release of everything (old one-argument call) skips the draft',
  pg_temp.val_as(:org1, 'authenticated', format($q$select count(*)::text from release_decisions(%L)$q$, :'ev')), '2');
select pg_temp.expect('the draft is still a draft', (select status from applications where user_id = :drafter), 'draft');
select pg_temp.expect('applicant now sees the released decision as status',
  pg_temp.val_as(:victim, 'authenticated', format($q$select status from applications where user_id = %L$q$, :victim)), 'rejected');


-- 6. OAuth-client tokens never get staff powers (security 7) ------------------

select pg_temp.expect('organizer''s own session is staff',
  pg_temp.val_as(:org1, 'authenticated', format($q$select is_event_staff(%L)::text$q$, :'ev')), 'true');
select pg_temp.expect('the same organizer through an OAuth client is not',
  pg_temp.val_claims(jsonb_build_object('sub', :org1, 'client_id', 'mcp-client-123'), 'authenticated', format($q$select is_event_staff(%L)::text$q$, :'ev')), 'false');
select pg_temp.expect('OAuth client sees no other applicants',
  pg_temp.val_claims(jsonb_build_object('sub', :org1, 'client_id', 'mcp-client-123'), 'authenticated', format($q$select count(*)::text from applications where event_id = %L$q$, :'ev')), '0');
select pg_temp.expect('OAuth client cannot read decisions',
  pg_temp.as_claims(jsonb_build_object('sub', :org1, 'client_id', 'mcp-client-123'), 'authenticated', format($q$select staged_decisions(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('OAuth client cannot release',
  pg_temp.as_claims(jsonb_build_object('sub', :org1, 'client_id', 'mcp-client-123'), 'authenticated', format($q$select * from release_decisions(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('OAuth client cannot add an organizer',
  pg_temp.as_claims(jsonb_build_object('sub', :org1, 'client_id', 'mcp-client-123'), 'authenticated', format($q$select add_organizer(%L, 'x@example.com')$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('OAuth client cannot read the mentor roster',
  pg_temp.as_claims(jsonb_build_object('sub', :org1, 'client_id', 'mcp-client-123'), 'authenticated', format($q$select * from mentor_roster(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('OAuth client can still read the user''s own application (MCP)',
  pg_temp.val_claims(jsonb_build_object('sub', :hacker, 'client_id', 'mcp-client-123'), 'authenticated', format($q$select status from applications where user_id = %L$q$, :hacker)), 'waitlisted');


-- 7. The last organizer (organizer M6) -----------------------------------------

select pg_temp.expect('org1 removes org2',
  pg_temp.as_req(:org1, 'authenticated', format($q$select remove_organizer(%L, 'org2@example.com')$q$, :'ev')), 'ok');
select pg_temp.expect('org2, already removed, can''t remove org1',
  pg_temp.as_req(:org2, 'authenticated', format($q$select remove_organizer(%L, 'org1@example.com')$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('one organizer left', (select count(*)::text from event_roles where event_id = :'ev' and role = 'organizer'), '1');
-- If something else tried to remove the last one through the API, the trigger refuses it.
create function pg_temp.delete_all_organizers(p_event uuid) returns void language plpgsql security definer as $$
begin delete from public.event_roles where event_id = p_event and role = 'organizer'; end $$;
grant execute on function pg_temp.delete_all_organizers(uuid) to authenticated;
select pg_temp.expect('deleting the last organizer as a signed-in user fails',
  pg_temp.as_req(:org1, 'authenticated', format($q$select pg_temp.delete_all_organizers(%L)$q$, :'ev')), '23514: %at least one organizer%');
select pg_temp.expect('the SQL editor can still delete a whole test event',
  pg_temp.as_req(null, 'service_role', format($q$delete from events where id = %L$q$, :'other')), 'ok');
