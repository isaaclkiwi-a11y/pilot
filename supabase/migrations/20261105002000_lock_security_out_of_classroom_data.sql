-- Prevent stale teacher assignments from granting Security accounts classroom access.
create or replace function private.can_access_student(p_school_id uuid,p_student_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select
    private.has_school_role(p_school_id,array['owner','school_admin','staff_admin']::text[])
    or (
      private.has_school_role(p_school_id,array['student']::text[])
      and exists (
        select 1 from public.students as student
         where student.id=p_student_id
           and student.school_id=p_school_id
           and student.auth_user_id=(select auth.uid())
      )
    )
    or exists (
      select 1 from public.class_enrollments as enrollment
      join public.class_staff_assignments as assignment
        on assignment.school_id=enrollment.school_id and assignment.class_id=enrollment.class_id
      join public.school_memberships as membership
        on membership.school_id=assignment.school_id
       and membership.user_id=assignment.user_id
       and membership.status='active'
       and membership.role=any(array['teacher','staff']::text[])
      where enrollment.school_id=p_school_id
        and enrollment.student_id=p_student_id
        and assignment.user_id=(select auth.uid())
    );
$$;

create or replace function private.can_manage_student(p_school_id uuid,p_student_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select
    private.has_school_role(p_school_id,array['owner','school_admin','staff_admin']::text[])
    or exists (
      select 1 from public.class_enrollments as enrollment
      join public.class_staff_assignments as assignment
        on assignment.school_id=enrollment.school_id and assignment.class_id=enrollment.class_id
      join public.school_memberships as membership
        on membership.school_id=assignment.school_id
       and membership.user_id=assignment.user_id
       and membership.status='active'
       and membership.role=any(array['teacher','staff']::text[])
      where enrollment.school_id=p_school_id
        and enrollment.student_id=p_student_id
        and assignment.user_id=(select auth.uid())
    );
$$;

drop policy if exists "Staff can view their class assignments" on public.class_staff_assignments;
create policy "Staff can view their class assignments"
  on public.class_staff_assignments for select to authenticated
  using (
    (user_id=(select auth.uid()) and private.has_school_role(school_id,array['teacher','staff']::text[]))
    or private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])
  );

drop policy if exists "Members can view classes in their school scope" on public.school_classes;
create policy "Members can view classes in their school scope"
  on public.school_classes for select to authenticated
  using (
    private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])
    or exists (
      select 1 from public.class_staff_assignments assignment
      join public.school_memberships membership
        on membership.school_id=assignment.school_id
       and membership.user_id=assignment.user_id
       and membership.status='active'
       and membership.role=any(array['teacher','staff']::text[])
      where assignment.school_id=school_classes.school_id
        and assignment.class_id=school_classes.id
        and assignment.user_id=(select auth.uid())
    )
  );
