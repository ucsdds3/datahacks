-- Hackers' day-of logistics: the columns, who can read them, and their checks
-- (migration *_hacker_logistics.sql). Run with supabase/tests/run.sh.
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
-- Sets one column on the test row the way the import script does (service role,
-- no user), returning 'ok' or the error.
create function pg_temp.set_col(p_col text, p_val text) returns text language plpgsql as $$
declare v text := 'ok';
begin
  begin
    execute format('update public.applications set %I = %s where user_id = %L', p_col, p_val, '99999999-0000-0000-0000-000000000001');
  exception when others then v := sqlstate || ': ' || sqlerrm;
  end;
  return v;
end $$;

\set ev '00000000-0000-0000-0000-00000000e501'
\set hk '''99999999-0000-0000-0000-000000000001'''
\set other '''99999999-0000-0000-0000-000000000002'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'Logistics Test', 'LOGI', true);
insert into auth.users (id, email, email_confirmed_at) values
  (:hk, 'hk@example.com', now()), (:other, 'other@example.com', now());
insert into public.profiles (id, email) select id, email from auth.users;

select pg_temp.expect('a hacker applies',
  pg_temp.as_req(:hk, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name) values (%L, %L, 'hacker', 'submitted', 'Hal')$q$,
    :hk, :'ev')), 'ok');
select pg_temp.expect('another hacker applies',
  pg_temp.as_req(:other, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, first_name) values (%L, %L, 'hacker', 'submitted', 'Ola')$q$,
    :other, :'ev')), 'ok');


-- 1. Columns and privileges ---------------------------------------------------

select pg_temp.expect('all eight are nullable text',
  (select string_agg(column_name || ' ' || data_type || ' ' || is_nullable, ', ' order by column_name)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'applications'
      and column_name in ('emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation', 'dietary_restrictions',
                          'shirt_size', 'overnight_stay', 'team_matching', 'logistics_source')),
  'dietary_restrictions text YES, emergency_contact_name text YES, emergency_contact_phone text YES, '
  || 'emergency_contact_relation text YES, logistics_source text YES, overnight_stay text YES, shirt_size text YES, team_matching text YES');
select pg_temp.expect('the review columns are still the only unreadable ones',
  (select string_agg(attname, ',' order by attname) from pg_attribute
    where attrelid = 'public.applications'::regclass and attnum > 0 and not attisdropped
      and not has_column_privilege('authenticated', 'public.applications', attname, 'SELECT')),
  'decided_at,decided_by,decision,decision_version');


-- 2. The import fills them, and only the applicant reads them -----------------

update public.applications
   set emergency_contact_name = 'Pat Example', emergency_contact_phone = '(858) 534-2230', emergency_contact_relation = 'Parent',
       dietary_restrictions = 'Peanuts', shirt_size = 'M', overnight_stay = 'maybe', team_matching = 'looking_for_team',
       logistics_source = 'dh26_import'
 where user_id = :hk;

select pg_temp.expect('the applicant reads their own',
  pg_temp.val_as(:hk, 'authenticated', $$select concat_ws(' / ', emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    dietary_restrictions, shirt_size, overnight_stay, team_matching, logistics_source) from applications$$),
  'Pat Example / (858) 534-2230 / Parent / Peanuts / M / maybe / looking_for_team / dh26_import');
select pg_temp.expect('another applicant can''t see them',
  pg_temp.val_as(:other, 'authenticated', format($q$select count(*)::text from applications where user_id = %L$q$, :hk)), '0');
select pg_temp.expect('anon can''t see them',
  pg_temp.val_as(null, 'anon', $$select count(*)::text from applications where emergency_contact_name is not null$$), '0');
select pg_temp.expect('the applicant can''t change a submitted row',
  pg_temp.val_as(:hk, 'authenticated', format($q$with u as (update applications set shirt_size = 'XL' where user_id = %L returning 1) select count(*)::text from u$q$, :hk)), '0');
select pg_temp.expect('still the imported size', (select shirt_size from applications where user_id = :hk), 'M');


-- 3. The checks ------------------------------------------------------------------

select pg_temp.expect('every shirt size fits',
  (select string_agg(pg_temp.set_col('shirt_size', quote_literal(s)), ',') from unnest(array['XXS','XS','S','M','L','XL','XXL']) s),
  'ok,ok,ok,ok,ok,ok,ok');
select pg_temp.expect('a lowercase shirt size is refused', pg_temp.set_col('shirt_size', $$'m'$$), '23514: %application_shirt_size_check%');
select pg_temp.expect('3XL is refused (XXL is the largest)', pg_temp.set_col('shirt_size', $$'3XL'$$), '23514: %application_shirt_size_check%');
select pg_temp.expect('overnight takes yes/no/maybe',
  pg_temp.set_col('overnight_stay', $$'yes'$$) || pg_temp.set_col('overnight_stay', $$'no'$$), 'okok');
select pg_temp.expect('overnight "Yes" is refused', pg_temp.set_col('overnight_stay', $$'Yes'$$), '23514: %application_overnight_stay_check%');
select pg_temp.expect('team matching takes its three values',
  pg_temp.set_col('team_matching', $$'team_needs_members'$$) || pg_temp.set_col('team_matching', $$'have_full_team'$$), 'okok');
select pg_temp.expect('team matching free text is refused', pg_temp.set_col('team_matching', $$'yes'$$), '23514: %application_team_matching_check%');
select pg_temp.expect('source takes applicant', pg_temp.set_col('logistics_source', $$'applicant'$$), 'ok');
select pg_temp.expect('an unknown source is refused', pg_temp.set_col('logistics_source', $$'sheet'$$), '23514: %application_logistics_source_check%');

select pg_temp.expect('a number abroad fits', pg_temp.set_col('emergency_contact_phone', $$'+919876543210'$$), 'ok');
select pg_temp.expect('dashes are refused (store the portal format)', pg_temp.set_col('emergency_contact_phone', $$'858-534-2230'$$), '23514: %application_emergency_contact_phone_check%');
select pg_temp.expect('a name in the phone is refused', pg_temp.set_col('emergency_contact_phone', $$'Mom'$$), '23514: %application_emergency_contact_phone_check%');
select pg_temp.expect('too few digits are refused', pg_temp.set_col('emergency_contact_phone', $$'+12345'$$), '23514: %application_emergency_contact_phone_check%');

select pg_temp.expect('200 characters of name fit', pg_temp.set_col('emergency_contact_name', quote_literal(repeat('n', 200))), 'ok');
select pg_temp.expect('201 are refused', pg_temp.set_col('emergency_contact_name', quote_literal(repeat('n', 201))), '23514: %application_emergency_contact_name_check%');
select pg_temp.expect('a line break in the name is refused', pg_temp.set_col('emergency_contact_name', $$E'Pat\nBcc: x'$$), '23514: %application_emergency_contact_name_check%');
select pg_temp.expect('a tab in the relation is refused', pg_temp.set_col('emergency_contact_relation', $$E'Par\tent'$$), '23514: %application_emergency_contact_relation_check%');
select pg_temp.expect('101 characters of relation are refused', pg_temp.set_col('emergency_contact_relation', quote_literal(repeat('r', 101))), '23514: %application_emergency_contact_relation_check%');
select pg_temp.expect('dietary answers may span lines', pg_temp.set_col('dietary_restrictions', $$E'Peanuts\nShellfish'$$), 'ok');
select pg_temp.expect('1000 characters of diet fit', pg_temp.set_col('dietary_restrictions', quote_literal(repeat('d', 1000))), 'ok');
select pg_temp.expect('1001 are refused', pg_temp.set_col('dietary_restrictions', quote_literal(repeat('d', 1001))), '23514: %application_dietary_restrictions_check%');
select pg_temp.expect('a control character in the diet is refused', pg_temp.set_col('dietary_restrictions', $$E'Nuts\x07'$$), '23514: %application_dietary_restrictions_check%');
