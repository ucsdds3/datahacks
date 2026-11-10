-- Mentor/judge applications: one confirmation for everyone applying to mentor,
-- judge or both, replacing the form's "both get priority" acknowledgement:
-- mentoring and judging are strictly in person, with no online option for either.
--
-- applications.acknowledged_in_person   the applicant ticked it. The form and the
--   MCP staff tool require it for mentor, judge and hybrid applications; rows
--   from before this keep false. acknowledged_both_priority stays (no longer
--   asked; default false).
--
-- Additive: one new column with a default, plus the column SELECT grant every
-- applications column needs since decisions_private. Lands before the form that
-- writes it (its own PR), so no submit ever names a column that isn't there yet.

alter table public.applications
  add column if not exists acknowledged_in_person boolean not null default false;

comment on column public.applications.acknowledged_in_person is
  'Mentors/judges: confirmed that mentoring and judging are strictly in person (no online option).';

grant select (acknowledged_in_person) on table public.applications to anon, authenticated;
