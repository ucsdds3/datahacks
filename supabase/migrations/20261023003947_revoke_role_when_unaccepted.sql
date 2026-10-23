-- Changing a released acceptance (say, accepted → rejected) used to leave the
-- person's portal role behind, so they kept the accepted-only pages. Now the
-- role their application granted goes when the application stops being
-- accepted. Organizer roles are never touched. (The check-in code already goes:
-- upsert_attendee drops the roster row unless they've checked in.)

create or replace function public.promote_accepted() returns trigger
  language plpgsql security definer
  set search_path to 'public'
as $$
declare
  v_user uuid := new.user_id;
  v_roles text[] := case new.applicant_type
    when 'mentor' then array['mentor']
    when 'judge'  then array['judge']
    when 'hybrid' then array['mentor','judge']
    else array['hacker']
  end;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted'
     and new.event_id is not null then

    if v_user is null and new.email is not null then
      select p.id into v_user
      from public.profiles p
      join auth.users u on u.id = p.id
      where lower(u.email) = lower(new.email)
        and u.email_confirmed_at is not null
      limit 1;

      if v_user is not null
         and not exists (select 1 from public.applications x
                         where x.user_id = v_user
                           and x.event_id = new.event_id) then
        update public.applications set user_id = v_user where id = new.id;
      end if;
    end if;

    if v_user is not null then
      insert into public.event_roles (event_id, user_id, role)
      select new.event_id, v_user, r::public.app_role
      from unnest(v_roles) as r
      on conflict do nothing;
    end if;

  elsif old.status = 'accepted' and new.status is distinct from 'accepted'
        and new.event_id is not null and v_user is not null then
    delete from public.event_roles er
    where er.event_id = new.event_id
      and er.user_id = v_user
      and er.role::text = any (v_roles);
  end if;
  return new;
end $$;
