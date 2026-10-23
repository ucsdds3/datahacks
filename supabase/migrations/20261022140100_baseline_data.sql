-- Rows the apps need to exist, not applicant data: the private resumes bucket
-- and the DataHacks 2026 event (code DH26) that the portal and check-in desk
-- use until the 2027 event is added. Both are no-ops where they already exist.

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

insert into public.events (id, name, code)
values ('96f5c446-76df-4001-948c-67c01a56ebcf', 'DataHacks 2026', 'DH26')
on conflict (id) do nothing;
