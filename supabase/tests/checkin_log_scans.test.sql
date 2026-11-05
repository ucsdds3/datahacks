-- Check-in batch 2 (migration *_checkin_log_scans.sql): the check-in log,
-- offline-safe check_in_by_code / undo_check_in, meal and swag scans, and the
-- ID-check fields. Run with supabase/tests/run.sh. Each check prints PASS or
-- raises FAIL. The whole file is one transaction, so now() is the same
-- throughout: times are set relative to it.
\set ON_ERROR_STOP on

-- Runs p_sql as a signed-in (or anon) API request; 'ok', or 'SQLSTATE: message'.
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
-- Same, returning the statement's single value as text (or the error).
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
-- An error's hint and detail as 'hint|detail' ('no error' if it went through).
create function pg_temp.hint_as(p_sub uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare v text := 'no error'; h text; d text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics h = pg_exception_hint, d = pg_exception_detail;
    v := coalesce(h, '') || '|' || coalesce(d, '');
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

\set ev '00000000-0000-0000-0000-00000000c001'
\set other '00000000-0000-0000-0000-00000000c002'
\set org '''44444444-0000-0000-0000-000000000001'''
\set outsider '''44444444-0000-0000-0000-000000000002'''
\set orgother '''44444444-0000-0000-0000-000000000003'''

-- The event started 30 days ago at 9:00 Pacific, so "18 on the day" can be
-- tested on both sides with birthdates the application rules allow (18+ today).
insert into public.events (id, name, code, starts_at) values
  (:'ev', 'Check-in Test', 'CLS', ((current_date - 30)::text || ' 09:00')::timestamp at time zone 'America/Los_Angeles'),
  (:'other', 'Other Event', 'OTH', now() - interval '1 year');

insert into auth.users (id, email, email_confirmed_at) values
  (:org, 'evan@example.com', now()), (:outsider, 'outsider@example.com', now()), (:orgother, 'orgother@example.com', now());
insert into auth.users (id, email, email_confirmed_at)
select ('55555555-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'h' || lpad(n::text, 2, '0') || '@example.com', now()
  from generate_series(1, 9) n;
insert into public.profiles (id, email) select id, email from auth.users;
update public.profiles set first_name = 'Evan', last_name = 'Park' where id = :org;
insert into public.event_roles (event_id, user_id, role) values
  (:'ev', :org, 'organizer'), (:'other', :orgother, 'organizer');

create function pg_temp.u(n int) returns uuid language sql as $$
  select ('55555555-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.app(n int) returns uuid language sql as $$
  select id from public.applications where user_id = pg_temp.u(n) $$;
create function pg_temp.code(n int) returns text language sql as $$
  select code from public.attendees where application_id = pg_temp.app(n) $$;
create function pg_temp.event_day() returns date language sql as $$
  select (starts_at at time zone 'America/Los_Angeles')::date from public.events where id = '00000000-0000-0000-0000-00000000c001' $$;

-- Accepted hackers h01-h08 at the event, h09 at the other event.
--   h01 18th birthday exactly on the event day      -> 18+
--   h02 18th birthday the day after the event       -> under 18
--   h03 no birthdate                                -> unknown
--   h04-h08 20 years old                            -> 18+
insert into public.applications (user_id, event_id, applicant_type, status, decision, first_name, last_name, school, birthdate)
select pg_temp.u(n), case when n = 9 then :'other'::uuid else :'ev'::uuid end, 'hacker', 'accepted', 'accepted',
       'H' || lpad(n::text, 2, '0'), 'Test', '  UC San Diego  ',
       case n when 1 then (pg_temp.event_day() - interval '18 years')::date
              when 2 then (pg_temp.event_day() - interval '18 years' + interval '1 day')::date
              when 3 then null
              else (current_date - interval '20 years')::date end
  from generate_series(1, 9) n;
-- A mentor (staff form: no birthdate), with an organization.
insert into public.applications (event_id, applicant_type, status, decision, first_name, last_name, email, organization, role_title,
                                 linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring, school)
values (:'ev', 'mentor', 'accepted', 'accepted', 'Mia', 'Mentor', 'mia@example.com', 'Qualcomm', 'Engineer',
        'https://www.linkedin.com/in/mia', 'none', true, 'UCLA');
create function pg_temp.mentor_code() returns text language sql as $$
  select t.code from public.attendees t join public.applications a on a.id = t.application_id where a.email = 'mia@example.com' $$;

select pg_temp.expect('roster rows made', (select count(*)::text from attendees where event_id = :'ev'), '9');

-- 4. ID check ---------------------------------------------------------------
select pg_temp.expect('18th birthday on the event day is 18+', (select is_18_plus_on_event_day::text from attendees where code = pg_temp.code(1)), 'true');
select pg_temp.expect('18th birthday the day after is under 18', (select is_18_plus_on_event_day::text from attendees where code = pg_temp.code(2)), 'false');
select pg_temp.expect('no birthdate is unknown', (select coalesce(is_18_plus_on_event_day::text, 'null') from attendees where code = pg_temp.code(3)), 'null');
select pg_temp.expect('hacker affiliation is the school, trimmed', (select affiliation from attendees where code = pg_temp.code(1)), 'UC San Diego');
select pg_temp.expect('mentor affiliation is the organization, no age',
  (select affiliation || ',' || coalesce(is_18_plus_on_event_day::text, 'null') from attendees where code = pg_temp.mentor_code()), 'Qualcomm,null');
select pg_temp.expect('event day is the Pacific date (06:00 UTC is still the day before)',
  is_18_plus_on('2008-03-10', '2026-03-10 06:00+00')::text || ',' || is_18_plus_on('2008-03-10', '2026-03-10 09:00+00')::text, 'false,true');
update public.events set starts_at = starts_at + interval '1 day' where id = :'ev';
select pg_temp.expect('moving the event start recomputes 18+', (select is_18_plus_on_event_day::text from attendees where code = pg_temp.code(2)), 'true');
update public.events set starts_at = starts_at - interval '1 day' where id = :'ev';
select pg_temp.expect('and back', (select is_18_plus_on_event_day::text from attendees where code = pg_temp.code(2)), 'false');
update public.applications set birthdate = (current_date - interval '30 years')::date where id = pg_temp.app(3);
select pg_temp.expect('a birthdate added later updates the roster', (select is_18_plus_on_event_day::text from attendees where code = pg_temp.code(3)), 'true');
update public.applications set birthdate = null where id = pg_temp.app(3);
select pg_temp.expect('the desk can''t read birthdates through the roster',
  (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'attendees' and column_name ilike '%birth%'), '0');

-- 2. Authorization -----------------------------------------------------------
select pg_temp.expect('check_in_by_code: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select check_in_by_code(%L, %L, now(), 'aaaaaaaa-0001', 'offline')$q$, :'ev', pg_temp.code(4))), 'P0001: Not authorized');
select pg_temp.expect('check_in_by_code: other event''s organizer refused',
  pg_temp.as_req(:orgother, 'authenticated', format($q$select check_in_by_code(%L, %L)$q$, :'ev', pg_temp.code(4))), 'P0001: Not authorized');
select pg_temp.expect('undo_check_in: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select undo_check_in(%L, %L, now())$q$, :'ev', pg_temp.code(4))), 'P0001: Not authorized');
select pg_temp.expect('anon can''t call check_in_by_code',
  pg_temp.as_req(null, 'anon', format($q$select check_in_by_code(%L, %L)$q$, :'ev', pg_temp.code(4))), '42501: %');
select pg_temp.expect('anon can''t call record_scan',
  pg_temp.as_req(null, 'anon', format($q$select record_scan(%L, %L, gen_random_uuid())$q$, :'ev', pg_temp.code(4))), '42501: %');
select pg_temp.expect('helpers aren''t callable',
  pg_temp.as_req(:org, 'authenticated', 'select clamp_desk_time(now())'), '42501: %');
select pg_temp.expect('desk_name isn''t callable', pg_temp.as_req(:org, 'authenticated', format('select desk_name(%L)', :org)), '42501: %');
select pg_temp.expect('nothing checked in by the refused calls', (select count(*)::text from attendees where checked_in_at is not null), '0');
select pg_temp.expect('one check_in_by_code and one undo_check_in (old forms dropped)',
  (select count(*)::text from pg_proc where proname in ('check_in_by_code', 'undo_check_in') and pronamespace = 'public'::regnamespace), '2');

-- 2. check_in_by_code ---------------------------------------------------------
-- The live app's call (two named arguments, as PostgREST sends it) still works.
select pg_temp.expect('old two-argument call checks in',
  pg_temp.val_as(:org, 'authenticated', format($q$select check_in_by_code(p_event_id => %L, p_code => %L)->>'status'$q$, :'ev', lower(pg_temp.code(4)))), 'ok');
select pg_temp.expect('online check-in is logged, now, by the organizer',
  (select kind || ',' || source || ',' || (scanned_at = now())::text || ',' || (by_user = :org)::text || ',' || coalesce(client_id, 'null')
     from checkin_events where code = pg_temp.code(4)), 'check_in,online,true,true,null');
select pg_temp.expect('answer has the ID-check fields and the waiver, not the birthdate',
  pg_temp.val_as(:org, 'authenticated', format($q$select (r ? 'affiliation')::text || (r ? 'is_18_plus_on_event_day')::text || (r ? 'waiver_signed_at')::text || (r::text ilike '%%birth%%')::text
    from check_in_by_code(%L, %L) r$q$, :'ev', pg_temp.code(1))), 'truetruetruefalse');
select pg_temp.expect('answer says 18+ and the school',
  pg_temp.val_as(:org, 'authenticated', format($q$select r->>'status' || ',' || (r->>'is_18_plus_on_event_day') || ',' || (r->>'affiliation') || ',' || (r->>'checked_in_by_name')
    from check_in_by_code(%L, %L) r$q$, :'ev', pg_temp.code(1))), 'dupe,true,UC San Diego,Evan');

-- Offline scan, sent later: keeps the scan time.
select pg_temp.expect('offline check-in keeps the scan time',
  pg_temp.val_as(:org, 'authenticated', format($q$select (check_in_by_code(%L, %L, now() - interval '40 minutes', 'aaaaaaaa-0005', 'offline')->>'checked_in_at')::timestamptz = now() - interval '40 minutes'$q$, :'ev', pg_temp.code(5))), 'true');
select pg_temp.expect('roster row has the scan time', (select (checked_in_at = now() - interval '40 minutes')::text from attendees where code = pg_temp.code(5)), 'true');
select pg_temp.expect('log row: offline, client id, scan time',
  (select source || ',' || client_id || ',' || (scanned_at = now() - interval '40 minutes')::text from checkin_events where code = pg_temp.code(5)), 'offline,aaaaaaaa-0005,true');
-- The answer was lost; the queue sends it again with the same client id.
select pg_temp.expect('same client id again: the first answer, not "already in"',
  pg_temp.val_as(:org, 'authenticated', format($q$select r->>'status' || ',' || (r->>'replay') || ',' || ((r->>'checked_in_at')::timestamptz = now() - interval '40 minutes')::text
    from check_in_by_code(%L, %L, now(), 'aaaaaaaa-0005', 'offline') r$q$, :'ev', pg_temp.code(5))), 'ok,true,true');
select pg_temp.expect('replay logs nothing', (select count(*)::text from checkin_events where code = pg_temp.code(5)), '1');
select pg_temp.expect('another desk''s scan of them is "already in"',
  pg_temp.val_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L, now(), 'aaaaaaaa-0055', 'offline')->>'status'$q$, :'ev', pg_temp.code(5))), 'dupe');
select pg_temp.expect('client id reused for someone else is refused',
  pg_temp.hint_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L, now(), 'aaaaaaaa-0005')$q$, :'ev', pg_temp.code(6))), 'client_id|');
select pg_temp.expect('malformed client id refused',
  pg_temp.hint_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L, now(), 'x; drop')$q$, :'ev', pg_temp.code(6))), 'client_id|');
select pg_temp.expect('unknown source refused',
  pg_temp.hint_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L, now(), null, 'carrier-pigeon')$q$, :'ev', pg_temp.code(6))), 'source|');
select pg_temp.expect('the refused calls checked nobody in', (select coalesce(checked_in_at::text, 'null') from attendees where code = pg_temp.code(6)), 'null');

-- Clamping: a phone clock that's far off can't put a check-in days back or in the future.
select pg_temp.expect('a time 2 days back is clamped to 12 hours back',
  pg_temp.val_as(:org, 'authenticated', format($q$select (check_in_by_code(%L, %L, now() - interval '2 days', 'aaaaaaaa-0006', 'offline')->>'checked_in_at')::timestamptz = now() - interval '12 hours'$q$, :'ev', pg_temp.code(6))), 'true');
select pg_temp.expect('a time 1 hour ahead is clamped to 2 minutes ahead',
  pg_temp.val_as(:org, 'authenticated', format($q$select (check_in_by_code(%L, %L, now() + interval '1 hour', 'aaaaaaaa-0007', 'offline')->>'checked_in_at')::timestamptz = now() + interval '2 minutes'$q$, :'ev', pg_temp.code(7))), 'true');
select pg_temp.expect('unknown code', pg_temp.val_as(:org, 'authenticated', format($q$select check_in_by_code(%L, 'CLS-H999', now(), 'aaaaaaaa-0999')::text$q$, :'ev')), '{"code": "CLS-H999", "status": "unknown"}');
select pg_temp.expect('another event''s code is unknown here',
  pg_temp.val_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L)->>'status'$q$, :'ev', pg_temp.code(9))), 'unknown');

-- A marked no-show still can't be checked in by code (waitlist migration's trigger).
update public.applications set no_show_at = now() where id = pg_temp.app(8);
select pg_temp.expect('no-show refused with hint no_show',
  pg_temp.hint_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L, now(), 'aaaaaaaa-0008', 'offline')$q$, :'ev', pg_temp.code(8))), 'no_show|');
select pg_temp.expect('no log row for the refused no-show', (select count(*)::text from checkin_events where code = pg_temp.code(8)), '0');
update public.applications set no_show_at = null where id = pg_temp.app(8);

-- 2. undo_check_in -------------------------------------------------------------
select pg_temp.expect('old two-argument undo works',
  pg_temp.val_as(:org, 'authenticated', format($q$select undo_check_in(p_event_id => %L, p_code => %L)->>'status'$q$, :'ev', pg_temp.code(4))), 'ok');
select pg_temp.expect('undo is logged',
  (select string_agg(kind, ',' order by id) from checkin_events where code = pg_temp.code(4)), 'check_in,undo');
-- h05 was checked in 40 minutes ago (offline). Desk A saw that; desk B undoes and checks them in again.
select pg_temp.as_req(:org, 'authenticated', format($q$select undo_check_in(%L, %L)$q$, :'ev', pg_temp.code(5)));
select pg_temp.as_req(:org, 'authenticated', format($q$select check_in_by_code(%L, %L, now() - interval '5 minutes', 'aaaaaaaa-0505', 'online')$q$, :'ev', pg_temp.code(5)));
select pg_temp.expect('undo of a check-in that was redone since is refused (checkin_changed, current time in detail)',
  pg_temp.hint_as(:org, 'authenticated', format($q$select undo_check_in(%L, %L, now() - interval '40 minutes', 'offline')$q$, :'ev', pg_temp.code(5))),
  'checkin_changed|' || (to_json(now() - interval '5 minutes') #>> '{}'));
select pg_temp.expect('they''re still checked in', (select (checked_in_at = now() - interval '5 minutes')::text from attendees where code = pg_temp.code(5)), 'true');
select pg_temp.expect('undo of the check-in the desk saw goes through (sub-second difference ignored)',
  pg_temp.val_as(:org, 'authenticated', format($q$select r->>'status' || ',' || ((r->>'checked_in_at')::timestamptz = now() - interval '5 minutes')::text
    from undo_check_in(%L, %L, now() - interval '5 minutes' + interval '300 milliseconds', 'offline') r$q$, :'ev', pg_temp.code(5))), 'ok,true');
select pg_temp.expect('undo of someone not checked in, with an expected time: not_checked_in (not refused)',
  pg_temp.val_as(:org, 'authenticated', format($q$select undo_check_in(%L, %L, now())->>'status'$q$, :'ev', pg_temp.code(5))), 'not_checked_in');
select pg_temp.expect('h05''s whole history is in the log',
  (select string_agg(kind || ':' || source, ',' order by id) from checkin_events where code = pg_temp.code(5)),
  'check_in:offline,undo:online,check_in:online,undo:offline');

-- 3. Scan types ----------------------------------------------------------------
select pg_temp.expect('organizer adds scan types',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into scan_types (event_id, label, kind, sort) values
    (%L, '  Lunch · Sat ', 'meal', 1), (%L, 'Dinner · Sat', 'meal', 2), (%L, 'T-shirt', 'swag', 3)$q$, :'ev', :'ev', :'ev')), 'ok');
select pg_temp.expect('label trimmed, stamped', (select label || ',' || (updated_by = :org)::text from scan_types where sort = 1), 'Lunch · Sat,true');
select pg_temp.expect('same label twice refused',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into scan_types (event_id, label) values (%L, 'lunch · sat')$q$, :'ev')), '23505: %');
select pg_temp.expect('unknown kind refused',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into scan_types (event_id, label, kind) values (%L, 'Hugs', 'hug')$q$, :'ev')), '23514: %');
select pg_temp.expect('window must close after it opens',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into scan_types (event_id, label, opens_at, closes_at) values (%L, 'Brunch', now(), now() - interval '1 hour')$q$, :'ev')), '23514: %');
select pg_temp.expect('organizer renames, reorders, switches off',
  pg_temp.as_req(:org, 'authenticated', $q$update scan_types set label = 'T-shirt · Sat', sort = 0, active = false where kind = 'swag'$q$), 'ok');
select pg_temp.expect('organizer can''t delete a scan type',
  pg_temp.as_req(:org, 'authenticated', 'delete from scan_types'), '42501: %');
select pg_temp.expect('non-organizer can''t read scan types',
  pg_temp.val_as(:outsider, 'authenticated', 'select count(*)::text from scan_types'), '0');
select pg_temp.expect('other event''s organizer can''t read them',
  pg_temp.val_as(:orgother, 'authenticated', 'select count(*)::text from scan_types'), '0');
select pg_temp.as_req(:outsider, 'authenticated', $q$update scan_types set label = 'Hacked'$q$);
select pg_temp.expect('non-organizer can''t change them', (select count(*)::text from scan_types where label = 'Hacked'), '0');
select pg_temp.expect('non-organizer can''t add them',
  pg_temp.as_req(:outsider, 'authenticated', format($q$insert into scan_types (event_id, label) values (%L, 'Free lunch')$q$, :'ev')), '42501: %');
select pg_temp.expect('anon can''t read them', pg_temp.as_req(null, 'anon', 'select * from scan_types'), '42501: %');
insert into scan_types (event_id, label) values (:'other', 'Other lunch');
create function pg_temp.st(p_label text) returns uuid language sql as $$ select id from public.scan_types where label = p_label $$;

-- 3. record_scan -------------------------------------------------------------
-- h01 is checked in; h02 isn't.
select pg_temp.expect('scan: checked-in hacker gets lunch',
  pg_temp.val_as(:org, 'authenticated', format($q$select r->>'status' || ',' || (r->>'label') || ',' || (r->>'kind') || ',' || (r->>'name')
    from record_scan(%L, %L, %L, null, 'bbbbbbbb-0001') r$q$, :'ev', lower(pg_temp.code(1)), pg_temp.st('Lunch · Sat'))), 'ok,Lunch · Sat,meal,H01 Test');
select pg_temp.expect('scan is logged',
  (select kind || ',' || (scan_type_id = pg_temp.st('Lunch · Sat'))::text || ',' || not_checked_in::text || ',' || (by_user = :org)::text
     from checkin_events where code = pg_temp.code(1) and kind = 'scan'), 'scan,true,false,true');
select pg_temp.expect('second lunch: already, with the first time and who',
  pg_temp.val_as(:org, 'authenticated', format($q$select r->>'status' || ',' || ((r->>'first_scanned_at')::timestamptz = now())::text || ',' || (r->>'by_name')
    from record_scan(%L, %L, %L, null, 'bbbbbbbb-0002') r$q$, :'ev', pg_temp.code(1), pg_temp.st('Lunch · Sat'))), 'already,true,Evan');
select pg_temp.expect('the same scan sent again (lost answer): the first answer',
  pg_temp.val_as(:org, 'authenticated', format($q$select r->>'status' || ',' || (r->>'replay')
    from record_scan(%L, %L, %L, now() - interval '1 minute', 'bbbbbbbb-0001', 'offline') r$q$, :'ev', pg_temp.code(1), pg_temp.st('Lunch · Sat'))), 'ok,true');
select pg_temp.expect('one lunch row for h01', (select count(*)::text from checkin_events where code = pg_temp.code(1) and kind = 'scan'), '1');
select pg_temp.expect('dinner is a separate scan',
  pg_temp.val_as(:org, 'authenticated', format($q$select record_scan(%L, %L, %L)->>'status'$q$, :'ev', pg_temp.code(1), pg_temp.st('Dinner · Sat'))), 'ok');
select pg_temp.expect('not checked in: recorded, flagged',
  pg_temp.val_as(:org, 'authenticated', format($q$select record_scan(%L, %L, %L, now() - interval '3 hours', 'bbbbbbbb-0003', 'offline')->>'status'$q$, :'ev', pg_temp.code(2), pg_temp.st('Lunch · Sat'))), 'not_checked_in');
select pg_temp.expect('flag and scan time on the log row',
  (select not_checked_in::text || ',' || source || ',' || (scanned_at = now() - interval '3 hours')::text from checkin_events where code = pg_temp.code(2) and kind = 'scan'),
  'true,offline,true');
select pg_temp.expect('replay of a flagged scan says not_checked_in again',
  pg_temp.val_as(:org, 'authenticated', format($q$select record_scan(%L, %L, %L, null, 'bbbbbbbb-0003', 'offline')->>'status'$q$, :'ev', pg_temp.code(2), pg_temp.st('Lunch · Sat'))), 'not_checked_in');
select pg_temp.expect('their second lunch is "already"',
  pg_temp.val_as(:org, 'authenticated', format($q$select record_scan(%L, %L, %L)->>'status'$q$, :'ev', pg_temp.code(2), pg_temp.st('Lunch · Sat'))), 'already');
select pg_temp.expect('not on the roster',
  pg_temp.val_as(:org, 'authenticated', format($q$select r->>'status' || ',' || (r->>'code') from record_scan(%L, 'CLS-H999', %L) r$q$, :'ev', pg_temp.st('Lunch · Sat'))), 'not_on_roster,CLS-H999');
select pg_temp.expect('a switched-off scan type still records (queued scans never fail on it)',
  pg_temp.val_as(:org, 'authenticated', format($q$select record_scan(%L, %L, %L)->>'status'$q$, :'ev', pg_temp.code(1), pg_temp.st('T-shirt · Sat'))), 'ok');
select pg_temp.expect('another event''s scan type is refused',
  pg_temp.hint_as(:org, 'authenticated', format($q$select record_scan(%L, %L, %L)$q$, :'ev', pg_temp.code(1), pg_temp.st('Other lunch'))), 'scan_type|');
select pg_temp.expect('an unknown scan type is refused',
  pg_temp.hint_as(:org, 'authenticated', format($q$select record_scan(%L, %L, gen_random_uuid())$q$, :'ev', pg_temp.code(1))), 'scan_type|');
select pg_temp.expect('scan time clamped like check-ins',
  pg_temp.val_as(:org, 'authenticated', format($q$select (record_scan(%L, %L, %L, now() - interval '3 days')->>'scanned_at')::timestamptz = now() - interval '12 hours'$q$, :'ev', pg_temp.code(4), pg_temp.st('Dinner · Sat'))), 'true');
select pg_temp.expect('client id from a check-in can''t be reused for a scan',
  pg_temp.hint_as(:org, 'authenticated', format($q$select record_scan(%L, %L, %L, null, 'aaaaaaaa-0006')$q$, :'ev', pg_temp.code(6), pg_temp.st('Dinner · Sat'))), 'client_id|');
select pg_temp.expect('record_scan: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select record_scan(%L, %L, %L)$q$, :'ev', pg_temp.code(3), pg_temp.st('Dinner · Sat'))), 'P0001: Not authorized');
select pg_temp.expect('record_scan: other event''s organizer refused',
  pg_temp.as_req(:orgother, 'authenticated', format($q$select record_scan(%L, %L, %L)$q$, :'ev', pg_temp.code(3), pg_temp.st('Dinner · Sat'))), 'P0001: Not authorized');
select pg_temp.expect('the database itself allows one scan per person per type',
  (select count(*)::text from (select 1 from checkin_events where kind = 'scan' group by scan_type_id, attendee_id having count(*) > 1) d), '0');

-- 1. The log: who reads it, nobody changes it ----------------------------------
select pg_temp.expect('organizer reads the event''s log',
  pg_temp.val_as(:org, 'authenticated', format($q$select (count(*) = (select count(*) from checkin_events where event_id = %L))::text from checkin_events$q$, :'ev')), 'true');
select pg_temp.expect('non-organizer reads nothing', pg_temp.val_as(:outsider, 'authenticated', 'select count(*)::text from checkin_events'), '0');
select pg_temp.expect('other event''s organizer reads nothing', pg_temp.val_as(:orgother, 'authenticated', 'select count(*)::text from checkin_events'), '0');
select pg_temp.expect('anon can''t read it', pg_temp.as_req(null, 'anon', 'select * from checkin_events'), '42501: %');
select pg_temp.expect('organizer can''t write it directly',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into checkin_events (event_id, attendee_id, code, kind, scanned_at) values (%L, gen_random_uuid(), 'X', 'check_in', now())$q$, :'ev')), '42501: %');
select pg_temp.expect('organizer can''t update it', pg_temp.as_req(:org, 'authenticated', $q$update checkin_events set code = 'X'$q$), '42501: %');
select pg_temp.expect('organizer can''t delete it', pg_temp.as_req(:org, 'authenticated', 'delete from checkin_events'), '42501: %');
select pg_temp.expect('service role can''t update it', pg_temp.as_req(null, 'service_role', $q$update checkin_events set code = 'X'$q$), '42501: %');
select pg_temp.expect('service role can''t delete it', pg_temp.as_req(null, 'service_role', 'delete from checkin_events'), '42501: %');
select pg_temp.expect('even the table owner can''t update it',
  pg_temp.hint_as(null, 'postgres', $q$update checkin_events set scanned_at = now() - interval '1 day'$q$), 'append_only|');
select pg_temp.expect('even the table owner can''t delete from it',
  pg_temp.hint_as(null, 'postgres', 'delete from checkin_events'), 'append_only|');
select pg_temp.expect('or truncate it', pg_temp.hint_as(null, 'postgres', 'truncate checkin_events'), 'append_only|');
select pg_temp.expect('log intact', (select (count(*) > 10)::text from checkin_events), 'true');

-- Re-running the migration: nothing changes, except a check-in with no log row
-- (made before the log existed) is copied in once.
update public.attendees set checked_in_at = now() - interval '2 hours', checked_in_by = :org where code = pg_temp.code(3);
create temp table before_rerun as select count(*) as n from public.checkin_events;
set client_min_messages = warning;
\ir ../migrations/20261105120000_checkin_log_scans.sql
set client_min_messages = notice;
select pg_temp.expect('re-run backfills exactly the one check-in without a log row',
  (select (count(*) - (select n from before_rerun))::text from checkin_events), '1');
select pg_temp.expect('backfill row has their time and organizer',
  (select source || ',' || (scanned_at = now() - interval '2 hours')::text || ',' || (by_user = :org)::text from checkin_events where code = pg_temp.code(3)),
  'backfill,true,true');
set client_min_messages = warning;
\ir ../migrations/20261105120000_checkin_log_scans.sql
set client_min_messages = notice;
select pg_temp.expect('a second re-run adds nothing', (select (count(*) - (select n from before_rerun))::text from checkin_events), '1');
select pg_temp.expect('still one check_in_by_code after re-runs',
  (select count(*)::text from pg_proc where proname = 'check_in_by_code' and pronamespace = 'public'::regnamespace), '1');

-- Deleting an event takes its log and scan types with it (the only way rows go).
-- Applications don't cascade with their event, so they go first.
delete from public.applications where event_id = :'ev';
delete from public.events where id = :'ev';
select pg_temp.expect('event deleted with its log and scan types',
  (select count(*)::text from checkin_events where event_id = :'ev') || ',' || (select count(*)::text from scan_types where event_id = :'ev'), '0,0');
