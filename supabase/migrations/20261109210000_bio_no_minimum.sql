-- The mentor blurb is optional with no minimum length (Mohak, 2026-11-09).
-- Same staff-fields check as before, minus the 50-character floor on bio.
-- bio keeps its own 4000-character / control-character check (application_bio_check).
alter table public.applications drop constraint if exists applications_staff_fields_check;
alter table public.applications add constraint applications_staff_fields_check check (
  applicant_type = 'hacker'
  or (
    email is not null
    and organization is not null
    and role_title is not null
    and linkedin_url is not null
    and ucsd_affiliation is not null
    and (applicant_type = 'mentor' or (judging_track is not null and acknowledged_in_person_judging))
    and (applicant_type = 'judge' or acknowledged_onsite_mentoring)
  )
);
