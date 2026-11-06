-- Staff profile lifecycle and school settings controls.
create or replace function private.create_school_staff_profile_on_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_name text;
begin
  if new.role='student' then return new; end if;
  if new.status<>'active' then
    update public.school_staff_profiles set status='inactive',updated_at=now()
     where school_id=new.school_id and user_id=new.user_id;
    return new;
  end if;
  select p.full_name into v_name from public.profiles p where p.id=new.user_id;
  insert into public.school_staff_profiles(school_id,user_id,display_name,job_title,status,created_by)
  values(new.school_id,new.user_id,v_name,new.role,'active',new.user_id)
  on conflict(school_id,user_id) do update
    set display_name=coalesce(public.school_staff_profiles.display_name,excluded.display_name),
        job_title=excluded.job_title,status='active',updated_at=now();
  return new;
end;
$$;
revoke all on function private.create_school_staff_profile_on_membership() from public,anon,authenticated;
drop trigger if exists create_school_staff_profile_after_membership on public.school_memberships;
create trigger create_school_staff_profile_after_membership
after insert or update of role,status on public.school_memberships
for each row execute function private.create_school_staff_profile_on_membership();

insert into public.school_staff_profiles(school_id,user_id,display_name,job_title,status,created_by)
select sm.school_id,sm.user_id,p.full_name,sm.role,'active',sm.user_id
from public.school_memberships sm left join public.profiles p on p.id=sm.user_id
where sm.status='active' and sm.role<>'student'
on conflict(school_id,user_id) do update
set display_name=coalesce(public.school_staff_profiles.display_name,excluded.display_name),
    job_title=excluded.job_title,status='active',updated_at=now();

drop policy if exists "Admins can update school settings" on public.schools;
create policy "Admins can update school settings"
on public.schools for update to authenticated
using (private.has_school_role(id,array['owner','school_admin','staff_admin']::text[]))
with check (private.has_school_role(id,array['owner','school_admin','staff_admin']::text[]));
