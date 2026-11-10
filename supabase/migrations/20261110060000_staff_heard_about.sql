-- Mentor/judge applications ask "How did you hear about DataHacks?" (pick all
-- that apply; Mohak, 2026-11-09), saved in the existing applications.heard_about.
-- Mentors and judges get their own list, so application_heard_about_check now
-- takes the hacker form's options from hackers (unchanged) and the staff form's
-- options from mentors, judges and hybrids (src/staff-portal/formOptions.ts
-- HEARD_ABOUT and STAFF_HEARD_ABOUT: change either list and this constraint
-- changes with it). No mentor or judge application has had a heard_about until
-- now, so every row still passes.
--
-- Additive: the same check, widened. Lands before the form that sends the new
-- answers (its own PR), so no submit ever names an answer the database
-- doesn't take yet.

alter table public.applications drop constraint if exists application_heard_about_check;
alter table public.applications add constraint application_heard_about_check check (heard_about is null
  or (cardinality(heard_about) <= 20
      and case when applicant_type = 'hacker'
            then heard_about <@ array[
              'DS3 club or event', 'Email newsletter', 'Friend or word of mouth', 'Instagram', 'LinkedIn',
              'Major League Hacking (MLH)', 'Past DataHacks', 'Professor or class', 'Tabling on campus', 'Other']::text[]
            else heard_about <@ array[
              'MLH email', 'DataHacks Direct Reach-Out', 'UCSD''s The Basement', 'DataHacks Industry Sponsor',
              'Association with UCSD', 'IEEE Member', 'Word of Mouth', 'AI/Online Search', 'Other']::text[]
          end));
