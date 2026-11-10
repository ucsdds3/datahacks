-- Mentor/judge applications ask two more things (Mohak, 2026-11-09):
--
-- 1. "How did you hear about DataHacks?" (pick all that apply), saved in the
--    existing applications.heard_about. Mentors and judges get their own list,
--    so application_heard_about_check now takes the hacker form's options from
--    hackers and the staff form's options from mentors, judges and hybrids
--    (src/staff-portal/formOptions.ts HEARD_ABOUT and STAFF_HEARD_ABOUT; change
--    either list and this constraint changes with it). No mentor or judge
--    application has had a heard_about until now, so every row still passes.
--
-- 2. applications.judging_kind   what a judge (or hybrid) will judge:
--    'challenge'  their sponsor's challenge (they're with a DataHacks industry sponsor)
--    'track'      one of the tracks (everyone else)
--    Null for mentors, hackers and every row from before this. The form
--    pre-picks 'challenge' for people who heard about DataHacks through an
--    industry sponsor and 'track' for everyone else; they can change it.
--    Challenge judges still pick a judging_track, as a fallback.
--
-- Additive: a wider check on heard_about, one nullable column with its check,
-- and the column SELECT grant every applications column needs since
-- decisions_private. Lands before the form that writes them (its own PR), so
-- no submit ever names a column or answer the database doesn't take yet.

-- 1. heard_about -------------------------------------------------------------

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


-- 2. judging_kind ------------------------------------------------------------

alter table public.applications
  add column if not exists judging_kind text;

alter table public.applications drop constraint if exists application_judging_kind_check;
alter table public.applications add constraint application_judging_kind_check check (judging_kind is null
  or (judging_kind in ('challenge', 'track') and applicant_type in ('judge', 'hybrid')));

comment on column public.applications.judging_kind is
  'Judges/hybrids: challenge (judging their DataHacks industry sponsor''s challenge) or track (judging one of the tracks). Null for mentors, hackers and older rows.';

grant select (judging_kind) on table public.applications to anon, authenticated;
