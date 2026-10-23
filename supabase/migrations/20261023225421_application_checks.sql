-- Rules for what an application may contain, enforced by the database itself,
-- so nothing invalid is saved even when someone skips the website and calls
-- the Supabase API directly (see docs/untrusted-input.md).
--
-- Each text column gets a length cap comfortably above the form's maxLength,
-- and no control characters: single-line answers reject chr(1)–chr(31) and
-- chr(127) (so no tabs or line breaks in a name, which matters for email
-- headers); long answers still allow tab, newline and carriage return. Links
-- must be plain https:// URLs. Dropdown answers must be one of the form's
-- options (src/staff-portal/formOptions.ts): changing an option list there
-- needs a migration that changes the matching constraint here.
--
-- applicant_type, decision, judging_track and ucsd_affiliation were already
-- restricted by the baseline (applications_*_check).
--
-- Checked against every production application before writing (2026-10-23:
-- 24 of 24 pass every rule), so the constraints are added fully validated.

-- The two control-character classes used below (chr(0) can't be stored at all):
--   single-line: '[\x01-\x1f\x7f]'
--   long text:   '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'   (tab \x09, LF \x0a, CR \x0d allowed)

alter table public.applications

  -- Names and short answers
  add constraint application_first_name_check check (first_name is null
    or (char_length(first_name) <= 100 and first_name !~ '[\x01-\x1f\x7f]')),
  add constraint application_last_name_check check (last_name is null
    or (char_length(last_name) <= 100 and last_name !~ '[\x01-\x1f\x7f]')),
  add constraint application_country_of_residence_check check (country_of_residence is null
    or (char_length(country_of_residence) <= 100 and country_of_residence !~ '[\x01-\x1f\x7f]')),
  add constraint application_city_of_residence_check check (city_of_residence is null
    or (char_length(city_of_residence) <= 200 and city_of_residence !~ '[\x01-\x1f\x7f]')),
  add constraint application_school_check check (school is null
    or (char_length(school) <= 200 and school !~ '[\x01-\x1f\x7f]')),
  add constraint application_major_check check (major is null
    or (char_length(major) <= 200 and major !~ '[\x01-\x1f\x7f]')),
  add constraint application_organization_check check (organization is null
    or (char_length(organization) <= 200 and organization !~ '[\x01-\x1f\x7f]')),
  add constraint application_role_title_check check (role_title is null
    or (char_length(role_title) <= 200 and role_title !~ '[\x01-\x1f\x7f]')),
  add constraint application_travel_region_check check (travel_region is null
    or (char_length(travel_region) <= 200 and travel_region !~ '[\x01-\x1f\x7f]')),

  -- Contact details. The email pattern has no spaces, commas, angle brackets,
  -- quotes or question marks, so an address can't add recipients or headers
  -- to an email, or parameters to a mailto: link.
  add constraint application_email_check check (email is null
    or (char_length(email) <= 254
        and email ~ '^[A-Za-z0-9._+''-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$')),
  add constraint application_phone_check check (phone is null
    or phone ~ '^\(\d{3}\) \d{3}-\d{4}$'),

  -- Links: https only (no javascript:, data: or http:), a plain host (no
  -- user@ part), no whitespace, quotes, angle brackets or backslashes.
  add constraint application_linkedin_url_check check (linkedin_url is null
    or (char_length(linkedin_url) <= 500 and linkedin_url !~ '[\x01-\x1f\x7f]'
        and linkedin_url ~* '^https://[a-z0-9.-]+(:[0-9]+)?([/?#][^\s"<>\\]*)?$')),
  add constraint application_github_url_check check (github_url is null
    or (char_length(github_url) <= 500 and github_url !~ '[\x01-\x1f\x7f]'
        and github_url ~* '^https://[a-z0-9.-]+(:[0-9]+)?([/?#][^\s"<>\\]*)?$')),
  add constraint application_devpost_url_check check (devpost_url is null
    or (char_length(devpost_url) <= 500 and devpost_url !~ '[\x01-\x1f\x7f]'
        and devpost_url ~* '^https://[a-z0-9.-]+(:[0-9]+)?([/?#][^\s"<>\\]*)?$')),
  add constraint application_resume_url_check check (resume_url is null
    or (char_length(resume_url) <= 500 and resume_url !~ '[\x01-\x1f\x7f]'
        and resume_url ~* '^https://[a-z0-9.-]+(:[0-9]+)?([/?#][^\s"<>\\]*)?$')),
  -- A path inside the private resumes bucket, never ../ or absolute.
  add constraint application_resume_path_check check (resume_path is null
    or (char_length(resume_path) <= 500 and resume_path !~ '[\x01-\x1f\x7f]'
        and resume_path !~ '(^|/)\.\.(/|$)' and resume_path !~ '^/')),

  -- Long answers
  add constraint application_essay_proudest_project_check check (essay_proudest_project is null
    or (char_length(essay_proudest_project) <= 4000 and essay_proudest_project !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),
  add constraint application_essay_unique_thing_check check (essay_unique_thing is null
    or (char_length(essay_unique_thing) <= 4000 and essay_unique_thing !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),
  add constraint application_essay_goal_check check (essay_goal is null
    or (char_length(essay_goal) <= 4000 and essay_goal !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),
  add constraint application_bio_check check (bio is null
    or (char_length(bio) <= 4000 and bio !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),
  add constraint application_travel_stipend_reason_check check (travel_stipend_reason is null
    or (char_length(travel_stipend_reason) <= 4000 and travel_stipend_reason !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),
  add constraint application_funniest_joke_check check (funniest_joke is null
    or (char_length(funniest_joke) <= 1000 and funniest_joke !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),
  add constraint application_lifetime_goal_check check (lifetime_goal is null
    or (char_length(lifetime_goal) <= 1000 and lifetime_goal !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),

  -- Dropdowns (formOptions.ts). "Prefer to self-describe" and "Other" are
  -- options in their own right: the forms have no free-text box for them.
  add constraint application_status_check check (status in
    ('draft', 'submitted', 'accepted', 'waitlisted', 'rejected')),
  add constraint application_gender_check check (gender is null or gender in
    ('Woman', 'Man', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say')),
  -- Saved as the picked options joined with '; '.
  add constraint application_race_ethnicity_check check (race_ethnicity is null
    or (char_length(race_ethnicity) <= 1000
        and string_to_array(race_ethnicity, '; ') <@ array[
          'American Indian or Alaska Native', 'Asian', 'Black or African American', 'Hispanic or Latino',
          'Middle Eastern or North African', 'Native Hawaiian or Other Pacific Islander', 'White', 'Other',
          'Prefer not to say']::text[])),
  add constraint application_level_of_study_check check (level_of_study is null or level_of_study in
    ('High school', 'Undergraduate (2-year: community college, associate''s)', 'Undergraduate (3+ year: bachelor''s)',
     'Graduate (master''s, doctoral)', 'Post-doctorate', 'Code school or bootcamp',
     'Other vocational or trade program', 'Not currently a student', 'Other')),
  -- The form offers this year and the next seven; any plausible year is kept
  -- valid so the list can roll forward without a migration.
  add constraint application_graduation_year_check check (graduation_year is null
    or graduation_year in ('Already graduated', 'Not applicable')
    or graduation_year ~ '^(19|20)[0-9]{2}$'),
  add constraint application_hackathon_experience_check check (hackathon_experience is null or hackathon_experience in
    ('This will be my first', '1–2 hackathons', '3–5 hackathons', '6 or more')),
  add constraint application_travel_method_check check (travel_method is null or travel_method in
    ('Car', 'Bus', 'Train', 'Plane', 'Other')),
  add constraint application_travel_distance_check check (travel_distance is null or travel_distance in
    ('Under 50 miles', '50–200 miles', '200–500 miles', 'Over 500 miles', 'From outside the US')),
  add constraint application_heard_about_check check (heard_about is null
    or (cardinality(heard_about) <= 20
        and heard_about <@ array[
          'DS3 club or event', 'Email newsletter', 'Friend or word of mouth', 'Instagram', 'LinkedIn',
          'Major League Hacking (MLH)', 'Past DataHacks', 'Professor or class', 'Tabling on campus', 'Other']::text[])),
  -- Not on the current forms; kept small and free of control characters.
  add constraint application_attended_events_check check (attended_events is null
    or (cardinality(attended_events) <= 50
        and char_length(array_to_string(attended_events, '')) <= 5000
        and array_to_string(attended_events, ' ') !~ '[\x01-\x1f\x7f]')),

  -- At least 13 on the day they apply. Only ever gets easier to satisfy, so
  -- existing rows stay valid (and a backup restores) as time passes.
  add constraint application_birthdate_check check (birthdate is null
    or (birthdate >= date '1900-01-01' and birthdate <= (current_date - interval '13 years')::date));
