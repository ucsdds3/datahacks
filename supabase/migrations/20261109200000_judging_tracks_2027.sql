-- DataHacks 2027 judging tracks: Social Good, Biotech & Life Sciences,
-- Defense & Cybersecurity, Finance, Energy. Existing rows (DH27BETA test
-- applications) move to the closest new track; Entertainment has no successor
-- and becomes Energy.
alter table public.applications drop constraint if exists applications_judging_track_check;

update public.applications set judging_track = case judging_track
  when 'social_good_wellbeing' then 'social_good'
  when 'healthcare_health_tech' then 'biotech_life_sciences'
  when 'fintech_econ_finance' then 'finance'
  when 'entertainment' then 'energy'
  else judging_track end
where judging_track in ('social_good_wellbeing', 'healthcare_health_tech', 'fintech_econ_finance', 'entertainment');

alter table public.applications add constraint applications_judging_track_check check (
  judging_track is null
  or judging_track = any (array['social_good', 'biotech_life_sciences', 'defense_cybersecurity', 'finance', 'energy'])
);
