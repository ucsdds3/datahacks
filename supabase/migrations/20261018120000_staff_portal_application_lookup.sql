-- Lets a signed-in mentor/judge/hybrid read back their own application for the portal.
-- Requires 20261018000000_applications_applicant_type.sql (applicant_type/email on
-- public.applications). Run in the Supabase SQL editor (or `supabase db push`).
--
-- Staff apply without signing in, so their rows have no user_id and RLS hides them from
-- the public key. This function matches the row to the caller's signed-in email instead,
-- and returns only what the portal needs.

create or replace function public.get_my_staff_application()
returns table (first_name text, last_name text, applicant_type text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select a.first_name::text, a.last_name::text, a.applicant_type::text, a.status::text
  from public.applications a
  where a.applicant_type in ('mentor', 'judge', 'hybrid')
    and lower(a.email) = lower(auth.jwt() ->> 'email')
  order by a.submitted_at desc nulls last
  limit 1;
$$;

revoke all on function public.get_my_staff_application() from public, anon;
grant execute on function public.get_my_staff_application() to authenticated;
