-- Public live stats for the website's /stats page (src/pages/Stats.tsx).
-- Additive: one column, two functions; nothing existing changes.
--
-- events.stats_public   the per-event switch. Off by default, so no event (the
--                       DH27BETA test event, a new year's event before launch)
--                       has public stats until someone turns it on. On for
--                       DH27 here. To take the page's numbers down:
--                         update events set stats_public = false where code = 'DH27';
--                       The page then says the stats are paused.
--
-- public_event_stats(code)  anyone, signed in or not, can call it (the page
--   uses the anon key). It reads applications as its owner, so the table's
--   row-level security stays exactly as it is: anon still can't read a single
--   row. It returns only counts, over submitted applications (never drafts)
--   of that one event:
--     hackers           hacker applications
--     schools           how many different schools (case and spaces ignored)
--     first_time        hackers who answered "This will be my first"
--     attended_before   hackers who have been to DataHacks before
--     countries         how many different countries of residence
--     mentors_judges    mentor, judge and mentor+judge applications, the total only
--     top_schools, levels, majors, graduation_years
--                       [{label, count}], largest first, see the privacy rule
--     per_day           [{date, count, total}], hacker applications per day
--                       (Pacific time) and the running total, every day from the
--                       first application to today
--   Never a name, email, id, birthdate, phone, essay, link, gender, race,
--   decision or anything else about one person, and no cross-tabs.
--
-- The privacy rule for the lists: a school, major, level of study or
-- graduation year with fewer than 5 applicants is never named; it's folded
-- into "Other". "Other" itself is left out when it's under 5 too. Counts are
-- otherwise exact. The goal the page measures against is the page's own
-- constant, not stored here.
--
-- An event that isn't public (or doesn't exist) gets the same refusal, so the
-- function can't be used to find or read test events.

alter table public.events
  add column if not exists stats_public boolean not null default false;

update public.events set stats_public = true where upper(code) = 'DH27';


-- One list: groups free-text answers by lower-cased, trimmed text (labelled
-- with the most common spelling), keeps the p_top largest groups of 5 or more,
-- and folds the rest, plus any answer that is itself "Other", into "Other".
create or replace function public.public_stats_buckets(p_values text[], p_top integer) returns jsonb
  language sql immutable
  set search_path to ''
as $$
  with answers as (
    select btrim(v) as label
      from unnest(p_values) as v
     where btrim(coalesce(v, '')) <> ''
  ), grouped as (
    select lower(label) as k, count(*)::integer as n, mode() within group (order by label) as label
      from answers
     group by lower(label)
  ), ranked as (
    select k, n, label, row_number() over (order by (k <> 'other' and n >= 5) desc, n desc, label) as r
      from grouped
  ), shown as (
    select n, label, r from ranked where k <> 'other' and n >= 5 and r <= p_top
  ), folded as (
    select coalesce(sum(n), 0)::integer as n
      from ranked
     where not (k <> 'other' and n >= 5 and r <= p_top)
  )
  select coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by r) from shown), '[]'::jsonb)
      || (select case when n >= 5 then jsonb_build_array(jsonb_build_object('label', 'Other', 'count', n)) else '[]'::jsonb end
            from folded)
$$;

revoke all on function public.public_stats_buckets(text[], integer) from public, anon, authenticated;
grant execute on function public.public_stats_buckets(text[], integer) to service_role;


create or replace function public.public_event_stats(p_code text) returns jsonb
  language plpgsql stable security definer
  set search_path to ''
as $$
declare
  v_event uuid;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_result jsonb;
begin
  select e.id into v_event
    from public.events e
   where e.stats_public
     and e.code is not null
     and upper(e.code) = upper(btrim(coalesce(p_code, '')));

  if v_event is null then
    raise exception 'There are no public stats for that event.' using errcode = 'P0002';
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
