-- The event-day waitlist (migration *_waitlist_release.sql).
-- Run with supabase/tests/run.sh. Each check prints PASS or raises FAIL.
-- The whole file is one transaction, so now() is the same throughout: "past"
-- and "future" deadlines are set relative to it.
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
-- Same, returning the statement's single value as text.
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

\set ev '00000000-0000-0000-0000-00000000e001'
\set other '00000000-0000-0000-0000-00000000e002'
\set org '''22222222-0000-0000-0000-000000000001'''
\set outsider '''22222222-0000-0000-0000-000000000002'''
\set orgother '''22222222-0000-0000-0000-000000000003'''

insert into public.events (id, name, code, starts_at) values
  (:'ev', 'Waitlist Test', 'WLT', now()),
  (:'other', 'Other Event', 'OTH', now() - interval '1 year');

-- People: an organizer, a signed-in non-organizer, an organizer of the other event,
-- and hackers u01..u14 (all with accounts).
insert into auth.users (id, email, email_confirmed_at)
select ('22222222-0000-0000-0000-00000000000' || n)::uuid, e, now()
  from (values (1, 'org@example.com'), (2, 'outsider@example.com'), (3, 'orgother@example.com')) v(n, e);
insert into auth.users (id, email, email_confirmed_at)
select ('33333333-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || lpad(n::text, 2, '0') || '@example.com', now()
  from generate_series(1, 14) n;
insert into public.profiles (id, email) select id, email from auth.users;
insert into public.event_roles (event_id, user_id, role) values
  (:'ev', :org, 'organizer'), (:'other', :orgother, 'organizer');

-- Hacker applications (inserted as the SQL editor would, so no open-event check).
--   u01-u06 accepted (u01 and u02 at UCSD), u07-u12 waitlisted, u13 rejected, u14 at the other event.
--   Waitlist submission order: u09 first, then u07, u08, u10, u11, u12.
create function pg_temp.app(n int) returns uuid language sql as $$
  select id from public.applications where user_id = ('33333333-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
insert into public.applications (user_id, event_id, applicant_type, status, decision, first_name, last_name, school, submitted_at)
select ('33333333-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       case when n = 14 then :'other'::uuid else :'ev'::uuid end,
       'hacker',
       case when n <= 6 or n = 14 then 'accepted' when n <= 12 then 'waitlisted' else 'rejected' end,
       case when n <= 6 or n = 14 then 'accepted' when n <= 12 then 'waitlisted' else 'rejected' end,
       'U' || lpad(n::text, 2, '0'), 'Test',
       case when n in (1, 2) then 'University of California, San Diego' else 'Somewhere State' end,
       case n when 9 then now() - interval '30 days' else now() - interval '20 days' + n * interval '1 hour' end
  from generate_series(1, 14) n;

select pg_temp.expect('accepted hackers got roster rows', (select count(*)::text from attendees where event_id = :'ev'), '6');
select pg_temp.expect('UCSD matched by the form''s school name', is_ucsd_school('University of California, San Diego')::text, 'true');
select pg_temp.expect('UCSD short names match, other schools don''t',
  (select string_agg(is_ucsd_school(s)::text, ',') from unnest(array['UCSD', 'UC San Diego', 'San Diego State University', 'University of San Diego', null]) s),
  'true,true,false,false,false');

-- 1. Settings: organizers write, others neither read nor write.
select pg_temp.expect('organizer saves settings',
  pg_temp.as_req(:org, 'authenticated', format($q$insert into event_day_settings (event_id, hacker_capacity, checkin_cutoff_at, ucsd_checkin_cutoff_at) values (%L, 5, now() + interval '1 hour', now() - interval '1 minute')$q$, :'ev')), 'ok');
select pg_temp.expect('settings stamped with who saved them', (select (updated_by = :org)::text from event_day_settings where event_id = :'ev'), 'true');
select pg_temp.expect('release window defaults to 60 minutes', (select offer_window_minutes::text from event_day_settings where event_id = :'ev'), '60');
select pg_temp.expect('non-organizer can''t read settings',
  pg_temp.val_as(:outsider, 'authenticated', format($q$select count(*)::text from event_day_settings where event_id = %L$q$, :'ev')), '0');
select pg_temp.expect('organizer of another event can''t read them',
  pg_temp.val_as(:orgother, 'authenticated', format($q$select count(*)::text from event_day_settings where event_id = %L$q$, :'ev')), '0');
select pg_temp.expect('anon can''t read them',
  pg_temp.as_req(null, 'anon', 'select * from event_day_settings'), '42501: %');
select pg_temp.as_req(:outsider, 'authenticated', format($q$update event_day_settings set hacker_capacity = 999 where event_id = %L$q$, :'ev'));
select pg_temp.expect('non-organizer can''t change them', (select hacker_capacity::text from event_day_settings where event_id = :'ev'), '5');
select pg_temp.expect('non-organizer can''t create them for an event',
  pg_temp.as_req(:outsider, 'authenticated', format($q$insert into event_day_settings (event_id, hacker_capacity) values (%L, 1)$q$, :'other')), '42501: %');

-- 2. Every organizer RPC refuses a non-organizer (and an organizer of another event).
select pg_temp.expect('overview: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select waitlist_overview(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('overview: other event''s organizer refused',
  pg_temp.as_req(:orgother, 'authenticated', format($q$select waitlist_overview(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('mark_no_shows: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select * from mark_no_shows(%L)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('unmark_no_shows: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select unmark_no_shows(%L, '{}')$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('offer_waitlist_spots: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select * from offer_waitlist_spots(%L, 1)$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('accept_walk_in: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select accept_walk_in(%L, %L)$q$, :'ev', pg_temp.app(7))), 'P0001: Not authorized');
select pg_temp.expect('lookup_not_on_roster: non-organizer refused',
  pg_temp.as_req(:outsider, 'authenticated', format($q$select lookup_not_on_roster(%L, 'u07@example.com')$q$, :'ev')), 'P0001: Not authorized');
select pg_temp.expect('anon can''t call the RPCs',
  pg_temp.as_req(null, 'anon', format($q$select waitlist_overview(%L)$q$, :'ev')), '42501: %');
select pg_temp.expect('internal helpers aren''t callable',
  pg_temp.as_req(:org, 'authenticated', format($q$select give_waitlist_spot(%L, 60)$q$, pg_temp.app(7))), '42501: %');
select pg_temp.expect('nothing changed by the refused calls',
  (select count(*)::text from applications where event_id = :'ev' and status = 'waitlisted'), '6');

-- 3. Applicants opt in through the RPC only.
create function pg_temp.u(n int) returns uuid language sql as $$
  select ('33333333-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
select pg_temp.expect('waitlisted hacker opts in',
  pg_temp.val_as(pg_temp.u(7), 'authenticated', format($q$select (set_waitlist_opt_in(%L, true) is not null)::text$q$, :'ev')), 'true');
select pg_temp.as_req(pg_temp.u(n), 'authenticated', format($q$select set_waitlist_opt_in(%L, true)$q$, :'ev')) from generate_series(8, 11) n;
select pg_temp.expect('opting in twice keeps the first time',
  (select (waitlist_opt_in_at = (select waitlist_opt_in_at from applications where id = pg_temp.app(7)))::text
     from applications where id = pg_temp.app(7)), 'true');
select pg_temp.expect('u11 opts out again',
  pg_temp.val_as(pg_temp.u(11), 'authenticated', format($q$select coalesce(set_waitlist_opt_in(%L, false)::text, 'null')$q$, :'ev')), 'null');
select pg_temp.expect('accepted hacker can''t opt in',
  pg_temp.as_req(pg_temp.u(3), 'authenticated', format($q$select set_waitlist_opt_in(%L, true)$q$, :'ev')), 'P0001: Only waitlisted%');
select pg_temp.expect('no application at that event',
  pg_temp.as_req(pg_temp.u(14), 'authenticated', format($q$select set_waitlist_opt_in(%L, true)$q$, :'ev')), 'P0001: You don''t have%');
select pg_temp.expect('signed out can''t opt in',
  pg_temp.as_req(null, 'anon', format($q$select set_waitlist_opt_in(%L, true)$q$, :'ev')), '42501: %');
-- u12 tries the table directly (their row isn't a draft, so RLS stops it; the guard would too).
select pg_temp.as_req(pg_temp.u(12), 'authenticated', 'update applications set waitlist_opt_in_at = now() where user_id = auth.uid()');
select pg_temp.expect('direct write to opt-in ignored', (select coalesce(waitlist_opt_in_at::text, 'null') from applications where id = pg_temp.app(12)), 'null');
-- A draft can be edited by its owner, but not these columns.
insert into applications (user_id, event_id, applicant_type, status) values (:outsider, :'ev', 'hacker', 'draft');
select pg_temp.expect('draft owner''s edit goes through',
  pg_temp.as_req(:outsider, 'authenticated', $q$update applications set first_name = 'X', waitlist_opt_in_at = now(), no_show_at = now(), waitlist_offered_at = now() where user_id = auth.uid()$q$), 'ok');
select pg_temp.expect('but the waitlist columns are kept',
  (select first_name || ',' || coalesce(waitlist_opt_in_at::text, 'null') || ',' || coalesce(no_show_at::text, 'null') || ',' || coalesce(waitlist_offered_at::text, 'null')
     from applications where user_id = :outsider), 'X,null,null,null');
delete from applications where user_id = :outsider;

-- 4. Check-in: u03 and u04 arrive.
select pg_temp.as_req(:org, 'authenticated', format($q$select check_in_by_code(%L, %L)$q$, :'ev', code))
  from attendees where application_id in (pg_temp.app(3), pg_temp.app(4));
select pg_temp.expect('two checked in', (select count(*)::text from attendees where event_id = :'ev' and checked_in_at is not null), '2');

-- 5. Capacity math. Capacity 5: 2 checked in + 4 still expected = 6, so no room.
select pg_temp.expect('overview counts',
  pg_temp.val_as(:org, 'authenticated', format($q$select (o->>'checked_in') || '/' || (o->>'expected') || '/' || (o->>'open_spots') || '/' || jsonb_array_length(o->'queue') || '/' || (o->>'waitlisted') from waitlist_overview(%L) o$q$, :'ev')),
  '2/4/0/4/6');
select pg_temp.expect('only UCSD hackers are past their (earlier) cutoff',
  pg_temp.val_as(:org, 'authenticated', format($q$select string_agg(x->>'name', ',' order by x->>'name') from waitlist_overview(%L) o, jsonb_array_elements(o->'absent') x where (x->>'past_deadline')::boolean$q$, :'ev')),
  'U01 Test,U02 Test');
select pg_temp.expect('queue is in submission order; opted-out u11 and silent u12 left out',
  pg_temp.val_as(:org, 'authenticated', format($q$select string_agg(x->>'name', ',' order by n) from waitlist_overview(%L) o, jsonb_array_elements(o->'queue') with ordinality q(x, n)$q$, :'ev')),
  'U09 Test,U07 Test,U08 Test,U10 Test');
select pg_temp.expect('no open spot: offering gives nobody a spot',
  pg_temp.val_as(:org, 'authenticated', format($q$select count(*)::text from offer_waitlist_spots(%L, 3)$q$, :'ev')), '0');

-- 6. Mark no-shows: only UCSD (u01, u02) are past their cutoff.
select pg_temp.expect('mark no-shows marks the two UCSD hackers',
  pg_temp.val_as(:org, 'authenticated', format($q$select string_agg(name, ',' order by name) from mark_no_shows(%L)$q$, :'ev')), 'U01 Test,U02 Test');
select pg_temp.expect('marking again marks nobody new',
  pg_temp.val_as(:org, 'authenticated', format($q$select count(*)::text from mark_no_shows(%L)$q$, :'ev')), '0');
select pg_temp.expect('no-shows keep their status, decision and roster row',
  (select string_agg(a.status || ':' || a.decision || ':' || (t.code is not null)::text, ',')
     from applications a left join attendees t on t.application_id = a.id where a.id in (pg_temp.app(1), pg_temp.app(2))),
  'accepted:accepted:true,accepted:accepted:true');
select pg_temp.expect('a no-show''s code no longer checks in',
  pg_temp.as_req(:org, 'authenticated', format($q$select check_in_by_code(%L, %L)$q$, :'ev', (select code from attendees where application_id = pg_temp.app(1)))),
  'P0001: % was marked a no-show%');
select pg_temp.expect('open spots now 5 - 2 - 2 = 1',
  pg_temp.val_as(:org, 'authenticated', format($q$select o->>'open_spots' from waitlist_overview(%L) o$q$, :'ev')), '1');

-- Undo puts them back; then mark again.
select pg_temp.expect('undo no-shows',
  pg_temp.val_as(:org, 'authenticated', format($q$select unmark_no_shows(%L, array[%L, %L]::uuid[])::text$q$, :'ev', pg_temp.app(1), pg_temp.app(2))), '2');
select pg_temp.expect('undone: no room again', pg_temp.val_as(:org, 'authenticated', format($q$select o->>'open_spots' from waitlist_overview(%L) o$q$, :'ev')), '0');
select pg_temp.as_req(:org, 'authenticated', format($q$select * from mark_no_shows(%L)$q$, :'ev'));

-- 7. Offers: never more than the open spots, in order, and not twice.
select pg_temp.expect('asking for 3 offers only the 1 open spot, to the first in line',
  pg_temp.val_as(:org, 'authenticated', format($q$select string_agg(name || ':' || (code is not null)::text || ':' || (offer_expires_at = now() + interval '60 minutes')::text, ',') from offer_waitlist_spots(%L, 3)$q$, :'ev')),
  'U09 Test:true:true');
select pg_temp.expect('offered hacker is accepted, released, with the hacker role',
  (select a.status || ',' || a.decision || ',' || (a.decision_released_at is not null)::text || ',' ||
          exists (select 1 from event_roles r where r.user_id = a.user_id and r.event_id = a.event_id and r.role = 'hacker')::text
     from applications a where a.id = pg_temp.app(9)), 'accepted,accepted,true,true');
select pg_temp.expect('running it again offers nobody (their spot is held)',
  pg_temp.val_as(:org, 'authenticated', format($q$select count(*)::text from offer_waitlist_spots(%L, 3)$q$, :'ev')), '0');
select pg_temp.expect('a later release_decisions leaves them accepted',
  pg_temp.as_req(:org, 'authenticated', format($q$select * from release_decisions(%L)$q$, :'ev')), 'ok');
select pg_temp.expect('still accepted', (select status from applications where id = pg_temp.app(9)), 'accepted');

-- More room: two offered at once go to the next two in order.
update event_day_settings set hacker_capacity = 7 where event_id = :'ev';
select pg_temp.expect('two more spots go to u07 then u08',
  pg_temp.val_as(:org, 'authenticated', format($q$select string_agg(name, ',') from offer_waitlist_spots(%L, 5)$q$, :'ev')), 'U07 Test,U08 Test');
select pg_temp.expect('capacity full: 2 in + 5 expected = 7',
  pg_temp.val_as(:org, 'authenticated', format($q$select (o->>'checked_in') || '/' || (o->>'expected') || '/' || (o->>'open_spots') from waitlist_overview(%L) o$q$, :'ev')), '2/5/0');
select pg_temp.expect('offer list has the three', pg_temp.val_as(:org, 'authenticated', format($q$select jsonb_array_length(o->'offers')::text from waitlist_overview(%L) o$q$, :'ev')), '3');

-- 8. An expired offer is released by marking it a no-show, then re-offered.
update applications set waitlist_offer_expires_at = now() - interval '1 minute' where id = pg_temp.app(9);
select pg_temp.expect('the expired offer is marked a no-show',
  pg_temp.val_as(:org, 'authenticated', format($q$select string_agg(name, ',') from mark_no_shows(%L)$q$, :'ev')), 'U09 Test');
select pg_temp.expect('its spot goes to the next opted-in waitlister',
  pg_temp.val_as(:org, 'authenticated', format($q$select string_agg(name, ',') from offer_waitlist_spots(%L, 1)$q$, :'ev')), 'U10 Test');
select pg_temp.expect('queue now empty (u11 opted out, u12 never opted in)',
  pg_temp.val_as(:org, 'authenticated', format($q$select jsonb_array_length(o->'queue')::text from waitlist_overview(%L) o$q$, :'ev')), '0');
select pg_temp.expect('nothing left to offer',
  pg_temp.val_as(:org, 'authenticated', format($q$select count(*)::text from offer_waitlist_spots(%L, 1)$q$, :'ev')), '0');

-- 9. Walk-ins at the door respect capacity.
select pg_temp.expect('no room: walk-in refused, nothing changes',
  pg_temp.val_as(:org, 'authenticated', format($q$select accept_walk_in(%L, %L)->>'status'$q$, :'ev', pg_temp.app(12))), 'full');
select pg_temp.expect('u12 still waitlisted', (select status from applications where id = pg_temp.app(12)), 'waitlisted');
update event_day_settings set hacker_capacity = 8 where event_id = :'ev';
select pg_temp.expect('room: a waitlister who never opted in is let in, with a code',
  pg_temp.val_as(:org, 'authenticated', format($q$select (r->>'status') || ':' || (r->>'code' like 'WLT-H%%')::text from accept_walk_in(%L, %L) r$q$, :'ev', pg_temp.app(12))), 'accepted:true');
select pg_temp.expect('the walk-in checks in',
  pg_temp.val_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L)->>'status'$q$, :'ev', (select code from attendees where application_id = pg_temp.app(12)))), 'ok');
select pg_temp.expect('accepting them again changes nothing',
  pg_temp.val_as(:org, 'authenticated', format($q$select accept_walk_in(%L, %L)->>'status'$q$, :'ev', pg_temp.app(12))), 'already_accepted');
select pg_temp.expect('a rejected applicant isn''t eligible',
  pg_temp.val_as(:org, 'authenticated', format($q$select accept_walk_in(%L, %L)->>'status'$q$, :'ev', pg_temp.app(13))), 'not_eligible');
select pg_temp.expect('another event''s application is refused',
  pg_temp.as_req(:org, 'authenticated', format($q$select accept_walk_in(%L, %L)$q$, :'ev', pg_temp.app(14))), 'P0001: That application isn''t at this event.');
-- A no-show is readmitted only into an open spot.
select pg_temp.expect('no room for no-show u01',
  pg_temp.val_as(:org, 'authenticated', format($q$select accept_walk_in(%L, %L)->>'status'$q$, :'ev', pg_temp.app(1))), 'full');
update event_day_settings set hacker_capacity = 9 where event_id = :'ev';
select pg_temp.expect('room: u01 readmitted with the same code',
  pg_temp.val_as(:org, 'authenticated', format($q$select (r->>'status') || ':' || ((r->>'code') = (select code from attendees where application_id = %L))::text from accept_walk_in(%L, %L) r$q$, pg_temp.app(1), :'ev', pg_temp.app(1))), 'readmitted:true');
select pg_temp.expect('and checks in',
  pg_temp.val_as(:org, 'authenticated', format($q$select check_in_by_code(%L, %L)->>'status'$q$, :'ev', (select code from attendees where application_id = pg_temp.app(1)))), 'ok');

-- 10. Looking people up at the desk.
create function pg_temp.why(q text) returns text language sql as $$
  select pg_temp.val_as('22222222-0000-0000-0000-000000000001', 'authenticated',
    format($s$select concat_ws(':', r->>'reason', r->>'name', r->>'status', r->>'opted_in', r->>'event_name') from lookup_not_on_roster('00000000-0000-0000-0000-00000000e001', %L) r$s$, q)) $$;
select pg_temp.expect('lookup: waitlisted, opted out', pg_temp.why('U11@example.com'), 'waitlisted:U11 Test:waitlisted:false');
select pg_temp.expect('lookup: no-show by code', pg_temp.why((select lower(code) from attendees where application_id = pg_temp.app(2))), 'no_show:U02 Test:accepted:false');
select pg_temp.expect('lookup: no-show offeree by email', pg_temp.why('u09@example.com'), 'no_show:U09 Test:accepted:true');
select pg_temp.expect('lookup: rejected', pg_temp.why('u13@example.com'), 'rejected:U13 Test:rejected:false');
select pg_temp.expect('lookup: already checked in', pg_temp.why('u03@example.com'), 'already_checked_in:U03 Test:accepted:false');
select pg_temp.expect('lookup: on the roster', pg_temp.why('u05@example.com'), 'on_roster:U05 Test:accepted:false');
select pg_temp.expect('lookup: applied to another event (its name only)', pg_temp.why('u14@example.com'), 'wrong_event:Other Event');
select pg_temp.expect('lookup: another event''s code', pg_temp.why((select code from attendees where application_id = pg_temp.app(14))), 'wrong_event:Other Event');
select pg_temp.expect('lookup: never applied', pg_temp.why('nobody@example.com'), 'never_applied');
select pg_temp.expect('lookup: unknown code', pg_temp.why('ZZZ-H999'), 'unknown_code');
select pg_temp.expect('lookup: no email or school in the answer',
  pg_temp.val_as(:org, 'authenticated', format($q$select (r ? 'email')::text || (r ? 'school')::text from lookup_not_on_roster(%L, 'u07@example.com') r$q$, :'ev')), 'falsefalse');

-- 11. Without settings the actions say what's missing.
delete from event_day_settings where event_id = :'ev';
select pg_temp.expect('mark without a cutoff',
  pg_temp.as_req(:org, 'authenticated', format($q$select * from mark_no_shows(%L)$q$, :'ev')), 'P0001: Set the check-in cutoff first.');
select pg_temp.expect('offer without a capacity',
  pg_temp.as_req(:org, 'authenticated', format($q$select * from offer_waitlist_spots(%L, 1)$q$, :'ev')), 'P0001: Set the hacker capacity first.');
select pg_temp.expect('overview without settings: open spots unknown',
  pg_temp.val_as(:org, 'authenticated', format($q$select coalesce(o->>'open_spots', 'null') || '/' || (o->'settings'->>'offer_window_minutes') from waitlist_overview(%L) o$q$, :'ev')), 'null/60');
