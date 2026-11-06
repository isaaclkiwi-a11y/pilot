drop policy if exists "Members can read basic school staff profiles" on public.school_staff_profiles;
create policy "Members can read basic school staff profiles" on public.school_staff_profiles
for select to authenticated using (
 private.has_school_role(school_id,array['owner','school_admin','staff_admin','teacher','staff','student','substitute']::text[])
);

drop policy if exists "Members can read announcements for their role" on public.school_announcements;
create policy "Members can read announcements for their role" on public.school_announcements
for select to authenticated using (
 private.has_school_role(school_id,array['owner','school_admin','staff_admin','teacher','staff','student','substitute']::text[])
 and (
  (status='published' and (
   audience='everyone'
   or (audience='staff' and private.has_school_role(school_id,array['owner','school_admin','staff_admin','teacher','staff','substitute']::text[]))
   or (audience='students' and private.has_school_role(school_id,array['student']::text[]))
  ))
  or (status<>'published' and private.has_school_role(school_id,array['owner','school_admin','staff_admin','teacher','staff','substitute']::text[]))
 )
);
