drop policy if exists "Admins manage bell schedules" on public.school_bell_schedules;
create policy "Admins insert bell schedules" on public.school_bell_schedules for insert to authenticated with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
create policy "Admins update bell schedules" on public.school_bell_schedules for update to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
create policy "Admins delete bell schedules" on public.school_bell_schedules for delete to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));

drop policy if exists "Admins manage periods" on public.school_periods;
create policy "Admins insert periods" on public.school_periods for insert to authenticated with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
create policy "Admins update periods" on public.school_periods for update to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
create policy "Admins delete periods" on public.school_periods for delete to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));

drop policy if exists "Admins manage class meetings" on public.school_class_meetings;
create policy "Admins insert class meetings" on public.school_class_meetings for insert to authenticated with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
create policy "Admins update class meetings" on public.school_class_meetings for update to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
create policy "Admins delete class meetings" on public.school_class_meetings for delete to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));

drop policy if exists "Admins manage substitute assignments" on public.substitute_assignments;
create policy "Admins insert substitute assignments" on public.substitute_assignments for insert to authenticated
with check (
 private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])
 and exists(select 1 from public.school_memberships teacher where teacher.school_id=substitute_assignments.school_id and teacher.user_id=substitute_assignments.teacher_user_id and teacher.status='active' and teacher.role='teacher')
 and exists(select 1 from public.school_memberships substitute where substitute.school_id=substitute_assignments.school_id and substitute.user_id=substitute_assignments.substitute_user_id and substitute.status='active' and substitute.role='substitute')
);
create policy "Admins update substitute assignments" on public.substitute_assignments for update to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
create policy "Admins delete substitute assignments" on public.substitute_assignments for delete to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));

drop policy if exists "Security can view all school passes" on public.hall_passes;
drop policy if exists "Users can read passes in their educational scope" on public.hall_passes;
create policy "Users can read passes in their educational scope" on public.hall_passes for select to authenticated
using (private.has_school_role(school_id,array['security']::text[]) or private.can_access_student(school_id,student_id));

create index if not exists hall_passes_ended_by_idx on public.hall_passes(ended_by);
create index if not exists school_bell_schedules_created_by_idx on public.school_bell_schedules(created_by);
create index if not exists school_class_meetings_class_school_idx on public.school_class_meetings(class_id,school_id);
create index if not exists school_class_meetings_created_by_idx on public.school_class_meetings(created_by);
create index if not exists school_class_meetings_period_school_idx on public.school_class_meetings(period_id,school_id);
create index if not exists school_periods_schedule_school_idx on public.school_periods(schedule_id,school_id);
create index if not exists school_periods_school_id_idx on public.school_periods(school_id);
create index if not exists substitute_assignments_created_by_idx on public.substitute_assignments(created_by);
create index if not exists substitute_assignments_ended_by_idx on public.substitute_assignments(ended_by);
