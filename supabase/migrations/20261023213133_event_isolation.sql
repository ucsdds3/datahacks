-- Keeps each event's data to itself, now that the DH27BETA test event stays in
-- the database next to the real DH27 (see docs/event-isolation.md).
--
-- 1. Resumes: any organizer of any event could read every resume in storage, so
--    an organizer of the test event could open real applicants' resumes. Now an
--    organizer can read a resume only when it is on an application at an event
--    they organize (the console opens resumes by applications.resume_path).
--
-- 2. An application stays in the event it was submitted to. Before, an
--    applicant could move their own draft, and an organizer of two events could
--    move an application (test data into the real event, say) by changing
--    event_id. Applying to another event means a new application.

drop policy if exists "organizers can read resumes" on storage.objects;
create policy "organizers can read resumes" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and exists (
    select 1 from public.applications a
    where a.resume_path = objects.name
      and public.is_event_staff(a.event_id)));


create or replace function public.applications_event_fixed() returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  if old.event_id is not null and new.event_id is distinct from old.event_id then
    raise exception 'Application % can''t move to another event. Submit a new application for that event instead.', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function public.applications_event_fixed() from public, anon, authenticated;
grant all on function public.applications_event_fixed() to service_role;

drop trigger if exists applications_event_fixed on public.applications;
create trigger applications_event_fixed before update of event_id on public.applications
  for each row execute function public.applications_event_fixed();
