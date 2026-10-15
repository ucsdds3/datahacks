-- Applications from people who want to mentor and/or judge at DataHacks.
-- Run this in the Supabase SQL editor (or `supabase db push`) before using /apply/mentor-judge.

create table if not exists public.mentor_judge_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  first_name text not null,
  last_name text not null,
  email text not null,

  -- 'mentor', 'judge' or 'both'
  applicant_type text not null check (applicant_type in ('mentor', 'judge', 'both')),

  organization text not null,
  role_title text not null,
  resume_url text not null,
  linkedin_url text not null,
  ucsd_affiliation text not null check (ucsd_affiliation in ('student', 'alumni', 'faculty', 'none')),

  -- only filled in for judges / both (one track)
  judging_track text
    check (judging_track in ('social_good_wellbeing', 'healthcare_health_tech', 'defense_cybersecurity', 'fintech_econ_finance', 'entertainment')),

  -- only filled in for mentors / both; shown to hackers on the mentor calendar
  bio text check (bio is null or char_length(bio) between 100 and 500),

  acknowledged_in_person_judging boolean not null default false,
  acknowledged_onsite_mentoring boolean not null default false,
  acknowledged_both_priority boolean not null default false,

  constraint judges_pick_a_track check (applicant_type = 'mentor' or judging_track is not null),
  constraint mentors_write_a_bio check (applicant_type = 'judge' or bio is not null),
  constraint judges_acknowledge_in_person check (applicant_type = 'mentor' or acknowledged_in_person_judging),
  constraint mentors_acknowledge_onsite check (applicant_type = 'judge' or acknowledged_onsite_mentoring)
);

create unique index if not exists mentor_judge_applications_email_key
  on public.mentor_judge_applications (lower(email));

alter table public.mentor_judge_applications enable row level security;

-- Anyone may submit an application; nobody can read them back with the public key.
create policy "anyone can apply"
  on public.mentor_judge_applications
  for insert
  to anon, authenticated
  with check (true);
