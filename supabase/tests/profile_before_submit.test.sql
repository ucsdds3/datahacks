-- The application forms make sure the account's profiles row exists just before
-- saving (src/portal/profile.ts): applications.user_id references profiles(id),
-- and a sign-in that never finished leaves a session with no profile. This checks
-- the write they send (insert ... on conflict (id) do nothing, as the signed-in
-- person) does what they rely on. Run with supabase/tests/run.sh.
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
create function pg_temp.expect(label text, got text, want text) returns void language plpgsql as $$
begin
  if got like want then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %: got [%], want [%]', label, got, want; end if;
end $$;
-- What ensureProfile sends (supabase-js upsert with ignoreDuplicates), as p_sub.
create function pg_temp.ensure_profile(p_sub uuid, p_id uuid, p_email text) returns text language sql as $$
  select pg_temp.as_req(p_sub, 'authenticated',
    format($q$insert into profiles (id, email) values (%L, %L) on conflict (id) do nothing$q$, p_id, p_email));
$$;
create function pg_temp.apply(p_sub uuid, p_event uuid) returns text language sql as $$
  select pg_temp.as_req(p_sub, 'authenticated', format(
    $q$insert into applications (user_id, event_id, applicant_type, status, submitted_at, first_name) values (%L, %L, 'hacker', 'submitted', now(), 'H')$q$,
    p_sub, p_event));
$$;

\set ev '00000000-0000-0000-0000-00000000e601'
\set hk '''99999999-0000-0000-0000-000000000601'''
\set other '''99999999-0000-0000-0000-000000000602'''
\set mentor '''99999999-0000-0000-0000-000000000603'''

insert into public.events (id, name, code, applications_open) values (:'ev', 'Profile Test', 'PROF', true);
-- Three signed-up accounts, none of which got a profile at sign-in.
insert into auth.users (id, email, email_confirmed_at) values
  (:hk, 'hk@example.com', now()), (:other, 'other@example.com', now()), (:mentor, 'Mentor@Example.com', now());


-- 1. The bug: no profile, so the application is refused ------------------------

select pg_temp.expect('without a profile the application is refused (the "something went wrong" error)',
  pg_temp.apply(:hk, :'ev'), '23503: %applications_user_id_fkey%');


-- 2. The fix: the form makes the profile first --------------------------------

select pg_temp.expect('the applicant can make their own missing profile', pg_temp.ensure_profile(:hk, :hk, 'hk@example.com'), 'ok');
select pg_temp.expect('as a hacker, with the email from their login',
  (select role::text || ' ' || email from public.profiles where id = :hk), 'hacker hk@example.com');
select pg_temp.expect('then the application goes in', pg_temp.apply(:hk, :'ev'), 'ok');


-- 3. An existing profile is left alone ----------------------------------------

update public.profiles set first_name = 'Kept' where id = :hk;
select pg_temp.expect('doing it again when the profile exists is not an error', pg_temp.ensure_profile(:hk, :hk, 'spoof@example.com'), 'ok');
select pg_temp.expect('and changes nothing', (select concat_ws(' ', first_name, email) from public.profiles where id = :hk), 'Kept hk@example.com');


-- 4. Only your own -------------------------------------------------------------

select pg_temp.expect('nobody can make a profile for another account',
  pg_temp.ensure_profile(:other, :mentor, 'mentor@example.com'), '42501: %row-level security%');
select pg_temp.expect('so it wasn''t made', (select count(*)::text from public.profiles where id = :mentor), '0');


-- 5. A mentor's application sent before they had an account is still linked ----

insert into public.applications (event_id, applicant_type, status, email, organization, role_title, linkedin_url, ucsd_affiliation, acknowledged_onsite_mentoring)
values (:'ev', 'mentor', 'submitted', 'mentor@example.com', 'O', 'R', 'https://l', 'none', true);
select pg_temp.expect('the mentor makes their missing profile', pg_temp.ensure_profile(:mentor, :mentor, 'Mentor@Example.com'), 'ok');
select pg_temp.expect('which links their application to the account, as signing in does',
  (select count(*)::text from public.applications where user_id = :mentor and applicant_type = 'mentor'), '1');
