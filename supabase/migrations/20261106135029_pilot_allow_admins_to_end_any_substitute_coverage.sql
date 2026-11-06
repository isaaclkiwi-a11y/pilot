drop policy if exists "Admins update substitute assignments" on public.substitute_assignments;
create policy "Admins update substitute assignments" on public.substitute_assignments
for update to authenticated
using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]))
with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
