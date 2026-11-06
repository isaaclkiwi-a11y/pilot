alter table public.school_memberships drop constraint if exists school_memberships_role_check;
alter table public.school_memberships add constraint school_memberships_role_check
 check (role = any(array['owner','school_admin','staff_admin','teacher','staff','security','student','substitute']::text[]));
alter table public.staff_invites drop constraint if exists staff_invites_role_check;
alter table public.staff_invites add constraint staff_invites_role_check
 check (role = any(array['teacher','staff','security','substitute']::text[]));

create or replace function private.can_access_class(p_school_id uuid,p_class_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select
   private.has_school_role(p_school_id,array['owner','school_admin','staff_admin']::text[])
   or exists (
     select 1 from public.class_staff_assignments assignment
     join public.school_memberships membership on membership.school_id=assignment.school_id
      and membership.user_id=assignment.user_id and membership.status='active'
      and membership.role=any(array['teacher','staff']::text[])
     where assignment.school_id=p_school_id and assignment.class_id=p_class_id
       and assignment.user_id=(select auth.uid())
   )
   or exists (
     select 1 from public.substitute_assignments coverage
     join public.school_memberships substitute_membership on substitute_membership.school_id=coverage.school_id
      and substitute_membership.user_id=coverage.substitute_user_id
      and substitute_membership.status='active'
      and substitute_membership.role=any(array['teacher','staff','substitute']::text[])
     join public.class_staff_assignments original_assignment on original_assignment.school_id=coverage.school_id
      and original_assignment.class_id=p_class_id and original_assignment.user_id=coverage.teacher_user_id
     join public.schools school on school.id=coverage.school_id
     where coverage.school_id=p_school_id and coverage.substitute_user_id=(select auth.uid())
       and coverage.status='active'
       and (now() at time zone school.timezone)::date between coverage.starts_on and coverage.ends_on
   );
$function$;

drop policy if exists "Admins manage substitute assignments" on public.substitute_assignments;
create policy "Admins manage substitute assignments" on public.substitute_assignments for all to authenticated
using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]))
with check (
 private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])
 and exists(select 1 from public.school_memberships teacher where teacher.school_id=substitute_assignments.school_id and teacher.user_id=substitute_assignments.teacher_user_id and teacher.status='active' and teacher.role='teacher')
 and exists(select 1 from public.school_memberships substitute where substitute.school_id=substitute_assignments.school_id and substitute.user_id=substitute_assignments.substitute_user_id and substitute.status='active' and substitute.role='substitute')
);
