-- Day-of logistics for hackers, which the DH26 Google Form asked and the DH27
-- application now asks too (Mohak, 2026-11-18):
--
-- applications.emergency_contact_name      who to call
-- applications.emergency_contact_phone     their number
-- applications.emergency_contact_relation  e.g. Mother, Friend
-- applications.dietary_restrictions        allergies or diet, as typed; null = none
-- applications.shirt_size                  XXS-3XL
-- applications.overnight_stay              yes / no / maybe
-- applications.team_matching               looking_for_team / team_needs_members / have_full_team
-- applications.logistics_source            where these came from: 'dh26_import'
--                                          (last year's form, scripts/import/dh26-logistics.mjs)
--                                          or 'applicant' (answered for DH27)
--
-- The hacker form's "Event details" section and the MCP hacker tool ask them
-- (required except dietary restrictions) and save logistics_source = 'applicant'.
-- Nullable, and not required by the database: mentors, judges and every
-- application submitted before this have none. For DH27 applicants who also
-- applied to DH26, scripts/import/dh26-logistics.mjs fills them from last
-- year's answers and never overwrites a value that's already there.
--
-- Same privacy as phone: RLS already limits applications to the applicant's own
-- row and the event's organizers, and SELECT is granted column by column since
-- decisions_private, so each column gets the grant every applications column
-- needs. Nothing public reads them: public_event_stats only counts, the MCP
-- server selects named columns, and the organizer console shows them only in
-- one application's details (src/organizer/data.ts DETAIL_COLUMNS).
--
-- Checks like application_checks: one-line text has no control characters and
-- a length cap; the dietary answer is long text (tab and line breaks allowed);
-- choices must be one of the listed values. The phone is either the portal's
-- US format, (858) 534-2230, or + and 7-15 digits for numbers abroad. Every
-- existing row is null, so the checks pass.
--
-- Additive: nullable columns with their checks and grants.

alter table public.applications
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relation text,
  add column if not exists dietary_restrictions text,
  add column if not exists shirt_size text,
  add column if not exists overnight_stay text,
  add column if not exists team_matching text,
  add column if not exists logistics_source text;

alter table public.applications drop constraint if exists application_emergency_contact_name_check;
alter table public.applications add constraint application_emergency_contact_name_check check (emergency_contact_name is null
  or (char_length(emergency_contact_name) <= 200 and emergency_contact_name !~ '[\x01-\x1f\x7f]'));

alter table public.applications drop constraint if exists application_emergency_contact_phone_check;
alter table public.applications add constraint application_emergency_contact_phone_check check (emergency_contact_phone is null
  or emergency_contact_phone ~ '^(\(\d{3}\) \d{3}-\d{4}|\+\d{7,15})$');

alter table public.applications drop constraint if exists application_emergency_contact_relation_check;
alter table public.applications add constraint application_emergency_contact_relation_check check (emergency_contact_relation is null
  or (char_length(emergency_contact_relation) <= 100 and emergency_contact_relation !~ '[\x01-\x1f\x7f]'));

alter table public.applications drop constraint if exists application_dietary_restrictions_check;
alter table public.applications add constraint application_dietary_restrictions_check check (dietary_restrictions is null
  or (char_length(dietary_restrictions) <= 1000 and dietary_restrictions !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'));

alter table public.applications drop constraint if exists application_shirt_size_check;
alter table public.applications add constraint application_shirt_size_check check (shirt_size is null
  or shirt_size in ('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'));

alter table public.applications drop constraint if exists application_overnight_stay_check;
alter table public.applications add constraint application_overnight_stay_check check (overnight_stay is null
  or overnight_stay in ('yes', 'no', 'maybe'));

alter table public.applications drop constraint if exists application_team_matching_check;
alter table public.applications add constraint application_team_matching_check check (team_matching is null
  or team_matching in ('looking_for_team', 'team_needs_members', 'have_full_team'));

alter table public.applications drop constraint if exists application_logistics_source_check;
alter table public.applications add constraint application_logistics_source_check check (logistics_source is null
  or logistics_source in ('dh26_import', 'applicant'));

comment on column public.applications.emergency_contact_name is
  'Hackers: emergency contact''s name. Null until asked for DH27 or imported from DH26 (logistics_source).';
comment on column public.applications.emergency_contact_phone is
  'Hackers: emergency contact''s phone, "(858) 534-2230" or "+" and 7-15 digits.';
comment on column public.applications.emergency_contact_relation is
  'Hackers: how the emergency contact is related to them.';
comment on column public.applications.dietary_restrictions is
  'Hackers: food allergies or dietary restrictions as typed; null means none given.';
comment on column public.applications.shirt_size is
  'Hackers: preferred T-shirt size, XXS-3XL.';
comment on column public.applications.overnight_stay is
  'Hackers: plans to stay at the venue overnight: yes, no or maybe.';
comment on column public.applications.team_matching is
  'Hackers: looking_for_team, team_needs_members or have_full_team.';
comment on column public.applications.logistics_source is
  'Where the logistics columns came from: dh26_import (last year''s form, prefilled) or applicant (answered for DH27).';

grant select (emergency_contact_name) on table public.applications to anon, authenticated;
grant select (emergency_contact_phone) on table public.applications to anon, authenticated;
grant select (emergency_contact_relation) on table public.applications to anon, authenticated;
grant select (dietary_restrictions) on table public.applications to anon, authenticated;
grant select (shirt_size) on table public.applications to anon, authenticated;
grant select (overnight_stay) on table public.applications to anon, authenticated;
grant select (team_matching) on table public.applications to anon, authenticated;
grant select (logistics_source) on table public.applications to anon, authenticated;
