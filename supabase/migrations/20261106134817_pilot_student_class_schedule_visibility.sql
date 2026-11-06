drop policy if exists "Members can view classes in their school scope" on public.school_classes;
create policy "Members can view classes in their school scope" on public.school_classes
for select to authenticated using (
 private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])
 or private.can_access_class(school_id,id)
 or exists (
  select 1 from public.class_enrollments enrollment
  join public.students student on student.id=enrollment.student_id and student.school_id=enrollment.school_id
  where enrollment.school_id=school_classes.school_id
   and enrollment.class_id=school_classes.id
   and student.auth_user_id=(select auth.uid())
 )
);
