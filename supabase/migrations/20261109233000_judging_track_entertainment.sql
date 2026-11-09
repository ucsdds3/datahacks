-- The fifth DataHacks 2027 judging track is Entertainment, not Energy (Mohak,
-- 2026-11-09). Move any Energy rows over, then allow the corrected list.
alter table public.applications drop constraint if exists applications_judging_track_check;
update public.applications set judging_track = 'entertainment' where judging_track = 'energy';
alter table public.applications add constraint applications_judging_track_check check (
  judging_track is null
  or judging_track = any (array['social_good', 'biotech_life_sciences', 'defense_cybersecurity', 'finance', 'entertainment'])
);
