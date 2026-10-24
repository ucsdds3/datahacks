-- Applicants give a link to their resume now; nobody uploads a file. Closes the
-- `resumes` bucket to new files and keeps the old DH26 ones readable.
--
-- The bucket had three policies on storage.objects (baseline, then
-- event_isolation): two for reading, one for uploading. There has never been an
-- update or delete policy. This drops the upload one only:
--   - "users can upload own resume" (insert): dropped.
--   - "users can read own resume" (select): kept, applicants still see theirs.
--   - "organizers can read resumes" (select): kept, organizers of the event a
--     resume was submitted to can still read it.
-- No files are deleted, the bucket stays, and applications.resume_path stays.
-- The service role ignores these policies, so an admin can still manage files.

drop policy if exists "users can upload own resume" on storage.objects;

-- Nothing else may write to the bucket either, such as a policy someone added
-- in the dashboard.
do $$
declare
  leftover text;
begin
  select string_agg(format('%s (%s)', policyname, cmd), ', ') into leftover
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE', 'ALL')
    and (coalesce(qual, '') || coalesce(with_check, '')) like '%resumes%';
  if leftover is not null then
    raise exception 'Resume uploads should be closed, but these policies still allow writes: %', leftover;
  end if;
end $$;
