-- New questions on the hacker application: GitHub, and how and how far
-- someone is traveling when they ask for travel reimbursement. Hackers now give
-- a resume link (resume_url, which mentor/judge applications already had)
-- instead of uploading a PDF; resume_path stays for applications sent before.
--
-- The mentor blurb becomes optional: at least 50 characters when given, no
-- maximum. Mentors who skip it get one written for them later.
--
-- Additive. Run in the Supabase SQL editor. Safe to run twice.

alter table public.applications
  add column if not exists github_url      text,
  add column if not exists travel_method   text,
  add column if not exists travel_distance text;

alter table public.applications drop constraint if exists applications_staff_fields_check;
alter table public.applications add constraint applications_staff_fields_check check (
  applicant_type = 'hacker'
  or (
    email is not null and organization is not null and role_title is not null
    and linkedin_url is not null and ucsd_affiliation is not null
    and (applicant_type = 'mentor' or (judging_track is not null and acknowledged_in_person_judging))
    and (applicant_type = 'judge' or ((bio is null or char_length(bio) >= 50) and acknowledged_onsite_mentoring))
  )
);

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'applications'
  and column_name in ('github_url', 'travel_method', 'travel_distance')
order by 1;
