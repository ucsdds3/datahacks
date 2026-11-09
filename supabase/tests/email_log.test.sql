-- The email log: claims, marking sent people straight away, and the daily
-- limit (migration *_email_log.sql). Run with supabase/tests/run.sh.
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
-- As the edge functions call them (service role).
create function pg_temp.claim(p_kind text, p_key text, p_app uuid) returns text language sql as $$
  select pg_temp.val_as(null, 'service_role', format('select claim_email(%L, %L, %L, %L)', '00000000-0000-0000-0000-00000000e101', p_kind, p_key, p_app)) $$;
create function pg_temp.finish(p_key text, p_ok boolean) returns text language sql as $$
  select pg_temp.as_req(null, 'service_role', format('select finish_email(%L, %L, %L)', p_key, p_ok, case when p_ok then null else 'SMTP 421 try later' end)) $$;

\set ev '00000000-0000-0000-0000-00000000e101'
\set org '''55555555-0000-0000-0000-000000000001'''
\set a1 '''55555555-0000-0000-0000-000000000002'''
\set a2 '''55555555-0000-0000-0000-000000000003'''

insert into public.events (id, name, code) values (:'ev', 'Email Test', 'EMT');
insert into auth.users (id, email, email_confirmed_at) values
  (:org, 'org@example.com', now()), (:a1, 'a1@example.com', now()), (:a2, 'a2@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;
insert into public.event_roles (event_id, user_id, role) values (:'ev', :org, 'organizer');
insert into public.applications (user_id, event_id, applicant_type, status, decision, decision_released_at, email, first_name)
values (:a1, :'ev', 'hacker', 'accepted', 'accepted', now(), 'a1@example.com', 'A'),
       (:a2, :'ev', 'hacker', 'rejected', 'rejected', now(), 'a2@example.com', 'B');
create function pg_temp.app(p_user uuid) returns uuid language sql as $$
  select id from public.applications where user_id = p_user $$;

-- 1. A decision email: claim, send, finish marks the person at once.
select pg_temp.expect('first claim', pg_temp.claim('decision', 'decision:a1:1', pg_temp.app(:a1)), 'claimed');
select pg_temp.expect('a second claim while it''s sending is busy (two organizers, or a retry racing)', pg_temp.claim('decision', 'decision:a1:1', pg_temp.app(:a1)), 'busy');
select pg_temp.expect('finish ok', pg_temp.finish('decision:a1:1', true), 'ok');
select pg_temp.expect('decision_emailed_at set straight away', (select (decision_emailed_at is not null)::text from applications where user_id = :a1), 'true');
select pg_temp.expect('a retry finds it sent', pg_temp.claim('decision', 'decision:a1:1', pg_temp.app(:a1)), 'sent');

-- 2. A failed send frees the key for a retry.
select pg_temp.expect('claim a2', pg_temp.claim('decision', 'decision:a2:1', pg_temp.app(:a2)), 'claimed');
select pg_temp.expect('SMTP failed', pg_temp.finish('decision:a2:1', false), 'ok');
select pg_temp.expect('failure recorded with its reason', (select status || '/' || error from email_log where dedupe_key = 'decision:a2:1'), 'failed/SMTP 421 try later');
select pg_temp.expect('not marked as emailed', (select coalesce(decision_emailed_at::text, 'null') from applications where user_id = :a2), 'null');
select pg_temp.expect('retry can claim it again', pg_temp.claim('decision', 'decision:a2:1', pg_temp.app(:a2)), 'claimed');

-- 3. A function that died mid-send: the claim is abandoned after 10 minutes and can be retried.
update email_log set claimed_at = now() - interval '11 minutes' where dedupe_key = 'decision:a2:1' and status = 'sending';
select pg_temp.expect('stale claim is reclaimed', pg_temp.claim('decision', 'decision:a2:1', pg_temp.app(:a2)), 'claimed');
select pg_temp.expect('old claim marked abandoned', (select count(*)::text from email_log where dedupe_key = 'decision:a2:1' and status = 'abandoned'), '1');
select pg_temp.finish('decision:a2:1', true);

-- 4. Decisions emailed before the log existed count as sent; a new release doesn't.
update applications set decision_emailed_at = now() + interval '1 second' where user_id = :a2;
select pg_temp.expect('legacy emailed decision is sent', pg_temp.claim('decision', 'decision:a2:legacy', pg_temp.app(:a2)), 'sent');
update applications set decision_released_at = now() + interval '1 minute' where user_id = :a2;
select pg_temp.expect('released again later: a new email is due', pg_temp.claim('offer', 'decision:a2:2', pg_temp.app(:a2)), 'claimed');
select pg_temp.finish('decision:a2:2', true);
select pg_temp.expect('an offer also marks waitlist_offer_emailed_at', (select (waitlist_offer_emailed_at is not null)::text from applications where user_id = :a2), 'true');

-- 5. Blasts: one per person per text, forever.
select pg_temp.expect('blast claim', pg_temp.claim('blast', 'blast:abc:a1', pg_temp.app(:a1)), 'claimed');
select pg_temp.finish('blast:abc:a1', true);
select pg_temp.expect('same blast again is skipped', pg_temp.claim('blast', 'blast:abc:a1', pg_temp.app(:a1)), 'sent');

-- 6. Passes mark attendees.emailed_at.
select pg_temp.expect('pass claim', pg_temp.claim('pass', 'pass:x:never:a1@example.com', pg_temp.app(:a1)), 'claimed');
select pg_temp.finish('pass:x:never:a1@example.com', true);
select pg_temp.expect('roster row marked as sent', (select (emailed_at is not null)::text from attendees where application_id = pg_temp.app(:a1)), 'true');

-- 7. Who can see and call what.
select pg_temp.expect('organizer can read the event''s log',
  pg_temp.val_as(:org, 'authenticated', format($q$select (count(*) > 0)::text from email_log where event_id = %L$q$, :'ev')), 'true');
select pg_temp.expect('applicant sees nothing',
  pg_temp.val_as(:a1, 'authenticated', $q$select count(*)::text from email_log$q$), '0');
select pg_temp.expect('applicant can''t write',
  pg_temp.as_req(:a1, 'authenticated', format($q$insert into email_log (event_id, kind, dedupe_key) values (%L, 'blast', 'x')$q$, :'ev')), '42501: %');
select pg_temp.expect('organizers can''t claim directly (edge functions only)',
  pg_temp.as_req(:org, 'authenticated', format($q$select claim_email(%L, 'blast', 'y', null)$q$, :'ev')), '42501: %');
select pg_temp.expect('organizer reads the quota',
  pg_temp.val_as(:org, 'authenticated', format($q$select (q ->> 'used') || '/' || (q ->> 'limit') || '/' || (q ->> 'remaining') from email_quota(%L) q$q$, :'ev')), '6/1800/1794');
select pg_temp.expect('applicant can''t',
  pg_temp.as_req(:a1, 'authenticated', format($q$select email_quota(%L)$q$, :'ev')), 'P0001: Not authorized');

-- 8. The daily limit: failed sends don't count; at the limit claims stop.
insert into email_log (event_id, kind, dedupe_key, status, claimed_at)
select :'ev', 'blast', 'filler:' || n, 'sent', now() - interval '1 hour' from generate_series(1, 1793) n;
insert into email_log (event_id, kind, dedupe_key, status, claimed_at)
select :'ev', 'blast', 'old:' || n, 'sent', now() - interval '25 hours' from generate_series(1, 50) n;
select pg_temp.expect('one slot left (old sends and failures don''t count)', pg_temp.claim('blast', 'blast:last:a1', pg_temp.app(:a1)), 'claimed');
select pg_temp.expect('then the limit stops claims', pg_temp.claim('blast', 'blast:over:a1', pg_temp.app(:a1)), 'quota');
select pg_temp.expect('quota shows none left',
  pg_temp.val_as(:org, 'authenticated', format($q$select (q ->> 'remaining') || '/' || (q ->> 'frees_at' is not null)::text from email_quota(%L) q$q$, :'ev')), '0/true');
