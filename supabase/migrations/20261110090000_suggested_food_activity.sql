-- Hacker applications ask two more things, both required on the form and in the
-- MCP hacker tool (Mohak, 2026-11-09):
--
-- applications.suggested_food       "Suggest a food item we should have at DataHacks"
-- applications.suggested_activity   "Suggest an activity we should run at DataHacks"
--
-- One line each, as typed (cleaned like the form's other one-line answers).
-- Nullable: mentors, judges and every application from before this have none,
-- so the database doesn't require them; the form and the MCP tool do.
--
-- Like the other short answers (application_checks): at most 200 characters,
-- comfortably above the form's 150 (MAX_LENGTH.short in src/lib/applicantInput.ts),
-- and no control characters. Every existing row is null, so the checks pass.
--
-- Additive: two nullable columns with their checks, plus the column SELECT
-- grant every applications column needs since decisions_private. Lands before
-- the form that writes them (its own PR), so no submit ever names a column
-- that isn't there yet.

alter table public.applications
  add column if not exists suggested_food text,
  add column if not exists suggested_activity text;

alter table public.applications drop constraint if exists application_suggested_food_check;
alter table public.applications add constraint application_suggested_food_check check (suggested_food is null
  or (char_length(suggested_food) <= 200 and suggested_food !~ '[\x01-\x1f\x7f]'));

alter table public.applications drop constraint if exists application_suggested_activity_check;
alter table public.applications add constraint application_suggested_activity_check check (suggested_activity is null
  or (char_length(suggested_activity) <= 200 and suggested_activity !~ '[\x01-\x1f\x7f]'));

comment on column public.applications.suggested_food is
  'Hackers: a food item they suggest we have at DataHacks. Required on the form; null for mentors/judges and older rows.';
comment on column public.applications.suggested_activity is
  'Hackers: an activity they suggest we run at DataHacks. Required on the form; null for mentors/judges and older rows.';

grant select (suggested_food) on table public.applications to anon, authenticated;
grant select (suggested_activity) on table public.applications to anon, authenticated;
