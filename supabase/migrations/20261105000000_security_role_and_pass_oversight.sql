-- Pilot: security role and school-wide hall-pass oversight
alter table public.school_memberships
  drop constraint if exists school_memberships_role_check;
alter table public.school_memberships
  add constraint school_memberships_role_check
  check (role = any (array['owner','school_admin','staff_admin','teacher','staff','security','student']::text[]));

alter table public.staff_invites
  drop constraint if exists staff_invites_role_check;
alter table public.staff_invites
  add constraint staff_invites_role_check
  check (role = any (array['teacher','staff','security']::text[]));

alter table public.hall_passes
  add column if not exists ended_by uuid references auth.users(id),
  add column if not exists ended_at timestamptz,
  add column if not exists end_reason text;

drop policy if exists "Security can view all school passes" on public.hall_passes;
create policy "Security can view all school passes"
  on public.hall_passes for select to authenticated
  using (private.has_school_role(school_id, array['security']::text[]));

create or replace function private.security_end_hall_pass(p_pass_id uuid,p_reason text default null)
returns public.hall_passes language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_pass public.hall_passes;
  v_reason text := nullif(left(btrim(coalesce(p_reason,'Ended by school security')),500),'');
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select hp.school_id into v_school_id from public.hall_passes hp where hp.id=p_pass_id for update;
  if v_school_id is null then raise exception 'Pass not found' using errcode='P0002'; end if;
  if not private.has_school_role(v_school_id,array['security']::text[]) then raise exception 'Security role required for this school' using errcode='42501'; end if;
  update public.hall_passes hp
     set status='returned',returned_at=now(),ended_by=v_user_id,ended_at=now(),
         end_reason=coalesce(v_reason,'Ended by school security'),updated_at=now()
   where hp.id=p_pass_id and hp.school_id=v_school_id and hp.status='active'
   returning hp.* into v_pass;
  if not found then raise exception 'Only active passes can be ended' using errcode='22023'; end if;
  return v_pass;
end;
$$;
revoke all on function private.security_end_hall_pass(uuid,text) from public,anon;
grant execute on function private.security_end_hall_pass(uuid,text) to authenticated;

create or replace function public.security_list_school_passes()
returns table(pass_id uuid,student_id uuid,student_number text,student_name text,origin text,destination text,reason text,status text,requested_at timestamptz,expected_duration_minutes integer,ended_at timestamptz,end_reason text)
language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $$
declare v_user_id uuid:=auth.uid(); v_school_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select sm.school_id into v_school_id from public.school_memberships sm
   where sm.user_id=v_user_id and sm.status='active' and sm.role='security'
   order by sm.created_at limit 1;
  if v_school_id is null then raise exception 'Security role required' using errcode='42501'; end if;
  return query
  select hp.id,hp.student_id,st.student_number,concat_ws(' ',st.first_name,st.last_name),
         hp.origin,hp.destination,hp.reason,hp.status,hp.requested_at,
         hp.expected_duration_minutes,hp.ended_at,hp.end_reason
    from public.hall_passes hp join public.students st on st.id=hp.student_id and st.school_id=hp.school_id
   where hp.school_id=v_school_id order by hp.requested_at desc limit 500;
end;
$$;
revoke all on function public.security_list_school_passes() from public,anon;
grant execute on function public.security_list_school_passes() to authenticated;

create or replace function public.security_end_hall_pass(p_pass_id uuid,p_reason text default null)
returns public.hall_passes language sql security invoker
set search_path = pg_catalog, public, private
as $$ select private.security_end_hall_pass(p_pass_id,p_reason); $$;
revoke all on function public.security_end_hall_pass(uuid,text) from public,anon;
grant execute on function public.security_end_hall_pass(uuid,text) to authenticated;
