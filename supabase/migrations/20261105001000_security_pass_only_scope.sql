-- Keep the Security role scoped to school-wide hall-pass oversight.
drop policy if exists "Members can read basic school staff profiles" on public.school_staff_profiles;
create policy "Members can read basic school staff profiles"
  on public.school_staff_profiles for select to authenticated
  using (private.has_school_role(school_id, array['owner','school_admin','staff_admin','teacher','staff','student']::text[]));

drop policy if exists "Users and admins can update school staff profiles" on public.school_staff_profiles;
create policy "Users and admins can update school staff profiles"
  on public.school_staff_profiles for update to authenticated
  using (
    (user_id = (select auth.uid()) and private.has_school_role(school_id, array['owner','school_admin','staff_admin','teacher','staff']::text[]))
    or private.has_school_role(school_id, array['owner','school_admin','staff_admin']::text[])
  )
  with check (
    (user_id = (select auth.uid()) and private.has_school_role(school_id, array['owner','school_admin','staff_admin','teacher','staff']::text[]))
    or private.has_school_role(school_id, array['owner','school_admin','staff_admin']::text[])
  );

drop policy if exists "School members can read school events" on public.school_events;
create policy "School members can read school events"
  on public.school_events for select to authenticated
  using (private.has_school_role(school_id, array['owner','school_admin','staff_admin','teacher','staff','student']::text[]));

drop policy if exists "Members can read announcements for their role" on public.school_announcements;
create policy "Members can read announcements for their role"
  on public.school_announcements for select to authenticated
  using (
    private.has_school_role(school_id, array['owner','school_admin','staff_admin','teacher','staff','student']::text[])
    and (
      (status='published' and (
        audience='everyone'
        or (audience='staff' and private.has_school_role(school_id,array['owner','school_admin','staff_admin','teacher','staff']::text[]))
        or (audience='students' and private.has_school_role(school_id,array['student']::text[]))
      ))
      or (status<>'published' and private.has_school_role(school_id,array['owner','school_admin','staff_admin','teacher','staff']::text[]))
    )
  );

drop policy if exists "School members can read their schools" on public.schools;
create policy "School members can read their schools"
  on public.schools for select to authenticated
  using (private.has_school_role(id, array['owner','school_admin','staff_admin','teacher','staff','student']::text[]));
