-- Accounts on the public live stats page (src/pages/Stats.tsx): how many people
-- have a DataHacks account this cycle, and how many of them have sent an
-- application. public_event_stats(code) returns everything it did before
-- (*_public_event_stats.sql, unchanged) plus two counts:
--
--   accounts            people with an account this cycle: an auth.users row
--                       created or last signed in on or after the cycle start,
--                       or any account with an application (a draft too) to
--                       this event
--   accounts_submitted  how many of those have a submitted application (not a
--                       draft) to this event, of any type: hacker, mentor,
--                       judge or both
--
-- The cycle start is the event's applications_open_at, or if that isn't set,
-- the event's earliest application (submitted_at, or created_at for one never
-- submitted). Neither count includes organizers (an organizer role on any
-- event) or test accounts (emails at example.com or loadtest.example.com).
--
-- Still counts only. The function reads auth.users as its owner, the way it
-- already reads applications, and only the two totals leave it: never an email
-- or an id. Same security definer, empty search_path and grants as before.

create or replace function public.public_event_stats(p_code text) returns jsonb
  language plpgsql stable security definer
  set search_path to ''
as $$
declare
  v_event uuid;
  v_start timestamptz;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_result jsonb;
begin
  select e.id, e.applications_open_at into v_event, v_start
    from public.events e
   where e.stats_public
     and e.code is not null
     and upper(e.code) = upper(btrim(coalesce(p_code, '')));

  if v_event is null then
    raise exception 'There are no public stats for that event.' using errcode = 'P0002';
  end if;

  -- The cycle starts when applications open, or failing that with the event's first application.
  if v_start is null then
    select min(coalesce(a.submitted_at, a.created_at)) into v_start
      from public.applications a
     where a.event_id = v_event;
  end if;

  with submitted as (
    select a.applicant_type, a.school, a.major, a.level_of_study, a.graduation_year,
           a.hackathon_experience, a.attended_before, a.country_of_residence,
           (coalesce(a.submitted_at, a.created_at) at time zone 'America/Los_Angeles')::date as day
      from public.applications a
     where a.event_id = v_event
       and a.status <> 'draft'
  ), hackers as (
    select * from submitted where applicant_type = 'hacker'
  ), days as (
    select d::date as day
      from generate_series((select min(day) from hackers)::timestamp,
                           greatest((select max(day) from hackers), v_today)::timestamp, interval '1 day') as d
  ), per_day as (
    select days.day, count(h.day)::integer as n
      from days
      left join hackers h on h.day = days.day
     group by days.day
  ), accounts as (
    select u.id
      from auth.users u
     where (u.created_at >= v_start
            or u.last_sign_in_at >= v_start
            or exists (select 1 from public.applications a where a.event_id = v_event and a.user_id = u.id))
       and not exists (select 1 from public.event_roles r where r.user_id = u.id and r.role = 'organizer')
       and lower(btrim(coalesce(u.email, ''))) not like '%@example.com'
       and lower(btrim(coalesce(u.email, ''))) not like '%@loadtest.example.com'
  )
  select jsonb_build_object(
    'event', (select e.code from public.events e where e.id = v_event),
    'generated_at', now(),
    'hackers', (select count(*) from hackers),
    'schools', (select count(distinct lower(btrim(school))) from hackers where btrim(coalesce(school, '')) <> ''),
    'first_time', (select count(*) from hackers where hackathon_experience = 'This will be my first'),
    'attended_before', (select count(*) from hackers where attended_before),
    'countries', (select count(distinct lower(btrim(country_of_residence))) from hackers where btrim(coalesce(country_of_residence, '')) <> ''),
    'mentors_judges', (select count(*) from submitted where applicant_type in ('mentor', 'judge', 'hybrid')),
    'accounts', (select count(*) from accounts),
    'accounts_submitted', (select count(*) from accounts u
                            where exists (select 1 from public.applications a
                                           where a.event_id = v_event and a.user_id = u.id and a.status <> 'draft')),
    'top_schools', public.public_stats_buckets((select array_agg(school) from hackers), 10),
    'levels', public.public_stats_buckets((select array_agg(level_of_study) from hackers), 20),
    'majors', public.public_stats_buckets((select array_agg(major) from hackers), 10),
    'graduation_years', public.public_stats_buckets((select array_agg(graduation_year) from hackers), 20),
    'per_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', n, 'total', total) order by day)
        from (select day, n, sum(n) over (order by day)::integer as total from per_day) running
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.public_event_stats(text) from public, anon, authenticated;
grant execute on function public.public_event_stats(text) to anon, authenticated, service_role;
