-- Mentor/judge applications: judges a sponsor sends say which company sent
-- them (a Databricks engineer judging for Databricks puts "Databricks").
--
-- applications.sponsor_affiliation   optional. The form and the MCP staff tool
--   ask judges and hybrids only, and save null when it's left blank, so it's
--   null for mentors, hackers and every row from before this. Same rule as the
--   other short answers (application_checks): at most 200 characters (the form
--   stops at 150), no control characters.
--
-- Additive: one nullable column and its check, plus the column SELECT grant
-- every applications column needs since decisions_private. Lands before the
-- form that writes it (its own PR), so no submit ever names a column that
-- isn't there yet.

alter table public.applications
  add column if not exists sponsor_affiliation text;

alter table public.applications
  drop constraint if exists application_sponsor_affiliation_check;
alter table public.applications
  add constraint application_sponsor_affiliation_check check (sponsor_affiliation is null
    or (char_length(sponsor_affiliation) <= 200 and sponsor_affiliation !~ '[\x01-\x1f\x7f]'));

comment on column public.applications.sponsor_affiliation is
  'Judges/hybrids, optional: the sponsor company they are judging on behalf of (e.g. Databricks). Null when not given.';

grant select (sponsor_affiliation) on table public.applications to anon, authenticated;
