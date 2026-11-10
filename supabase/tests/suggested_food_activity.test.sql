-- Hackers' suggested food and activity: the two columns, who can read them, and
-- their length and one-line checks (migration *_suggested_food_activity.sql).
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
-- A submitted hacker application as an API insert by that user, with the two answers as SQL literals.
create function pg_temp.apply(p_user uuid, p_event uuid, p_food text, p_activity text) returns text language sql as $$
  select pg_temp.as_req(p_user, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name, suggested_food, suggested_activity)
       values (%L, %L, 'hacker', 'submitted', 'Hal', %s, %s)$q$,
    p_user, p_event, p_food, p_activity)) $$;
-- Deletes that user's application, so one user can try several.
create function pg_temp.clear(p_user uuid) returns void language sql as $$ delete from public.applications where user_id = p_user $$;

\set ev '00000000-0000-0000-0000-00000000e401'
\set hk '''88888888-0000-0000-0000-000000000001'''
\set early '''88888888-0000-0000-0000-000000000002'''
\set mentor '''88888888-0000-0000-0000-000000000003'''
\set try '''88888888-0000-0000-0000-000000000004'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'Food Test', 'FOOD', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:hk, 'hk@example.com', now()), (:early, 'early@example.com', now()),
  (:mentor, 'mentor@example.com', now()), (:try, 'try@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;


-- 1. Columns and privileges ---------------------------------------------------

select pg_temp.expect('both are nullable text',
  (select string_agg(column_name || ' ' || data_type || ' ' || is_nullable, ', ' order by column_name)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name in ('suggested_food', 'suggested_activity')),
  'suggested_activity text YES, suggested_food text YES');
select pg_temp.expect('applicants can read both',
  (select string_agg(c, ',' order by c) from unnest(array['suggested_food', 'suggested_activity']) c
    where has_column_privilege('authenticated', 'public.applications', c, 'SELECT')
      and has_column_privilege('anon', 'public.applications', c, 'SELECT')),
  'suggested_activity,suggested_food');
select pg_temp.expect('the review columns are still the only unreadable ones',
  (select string_agg(attname, ',' order by attname) from pg_attribute
    where attrelid = 'public.applications'::regclass and attnum > 0 and not attisdropped
      and not has_column_privilege('authenticated', 'public.applications', attname, 'SELECT')),
  'decided_at,decided_by,decision,decision_version');


-- 2. Saving and reading them back ---------------------------------------------

select pg_temp.expect('a hacker applies with both suggestions',
  pg_temp.apply(:hk, :'ev', $$'Boba, poke bowls'$$, $$'Smash tournament'$$), 'ok');
select pg_temp.expect('and reads them back',
  pg_temp.val_as(:hk, 'authenticated', $$select suggested_food || ' / ' || suggested_activity from applications$$),
  'Boba, poke bowls / Smash tournament');
select pg_temp.expect('accents, emoji and quotes are fine',
  pg_temp.apply(:try, :'ev', $$'Crème brûlée 🍮 ("lots")'$$, $$'Karaoke & a 5K'$$), 'ok');
select pg_temp.clear(:try);

-- Applications from before the questions, and mentors, have none.
select pg_temp.expect('leaving both out still works (older rows)', pg_temp.apply(:early, :'ev', 'null', 'null'), 'ok');
select pg_temp.expect('and they stay null',
  (select coalesce(suggested_food, 'null') || '/' || coalesce(suggested_activity, 'null') from applications where user_id = :early), 'null/null');
select pg_temp.expect('a mentor applies without them',
  pg_temp.as_req(:mentor, 'authenticated', format($q$insert into applications (user_id, event_id, applicant_type, status, first_name, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring)
    values (%L, %L, 'mentor', 'submitted', 'Mo', 'Org', 'Eng', 'https://linkedin.com/in/x', 'none', true)$q$, :mentor, :'ev')), 'ok');


-- 3. The checks ------------------------------------------------------------------

select pg_temp.expect('the form''s longest answer (150) fits',
  pg_temp.apply(:try, :'ev', quote_literal(repeat('f', 150)), quote_literal(repeat('a', 150))), 'ok');
select pg_temp.clear(:try);
select pg_temp.expect('200 characters fit',
  pg_temp.apply(:try, :'ev', quote_literal(repeat('f', 200)), quote_literal(repeat('a', 200))), 'ok');
select pg_temp.clear(:try);
select pg_temp.expect('201 characters of food are refused',
  pg_temp.apply(:try, :'ev', quote_literal(repeat('f', 201)), $$'Trivia'$$), '23514: %application_suggested_food_check%');
select pg_temp.expect('201 characters of activity are refused',
  pg_temp.apply(:try, :'ev', $$'Tacos'$$, quote_literal(repeat('a', 201))), '23514: %application_suggested_activity_check%');
select pg_temp.expect('a line break in the food is refused (one line)',
  pg_temp.apply(:try, :'ev', $$E'Tacos\nBcc: x'$$, $$'Trivia'$$), '23514: %application_suggested_food_check%');
select pg_temp.expect('a tab in the activity is refused',
  pg_temp.apply(:try, :'ev', $$'Tacos'$$, $$E'Trivia\tnight'$$), '23514: %application_suggested_activity_check%');
select pg_temp.expect('a control character is refused',
  pg_temp.apply(:try, :'ev', $$E'Tacos\x07'$$, $$'Trivia'$$), '23514: %application_suggested_food_check%');
select pg_temp.expect('nothing was saved for the refused tries', (select count(*)::text from applications where user_id = :try), '0');

-- The submitted row can't be changed by the applicant afterwards (no update policy for them).
select pg_temp.expect('the applicant can''t change a submitted suggestion',
  pg_temp.val_as(:hk, 'authenticated', format($q$with u as (update applications set suggested_food = 'Pizza' where user_id = %L returning 1) select count(*)::text from u$q$, :hk)), '0');
select pg_temp.expect('still their first answer', (select suggested_food from applications where user_id = :hk), 'Boba, poke bowls');
