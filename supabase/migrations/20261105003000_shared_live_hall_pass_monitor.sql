-- Pilot shared live hall-pass monitor and server-synchronized countdowns.
-- Countdown begins when a pass is approved, not when a request is submitted.
create or replace function public.get_pilot_server_time()
returns timestamptz language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return statement_timestamp();
end;
$$;
revoke all on function public.get_pilot_server_time() from public, anon;
grant execute on function public.get_pilot_server_time() to authenticated;

create or replace function public.get_school_hall_pass_monitor()
returns table (
  pass_id uuid, school_id uuid, student_id uuid, student_number text, student_name text,
  origin text, destination text, reason text, status text, display_status text,
  requested_at timestamptz, approved_at timestamptz, expires_at timestamptz,
  expected_duration_minutes integer, returned_at timestamptz, ended_at timestamptz,
  end_reason text, server_now timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_school_id uuid;
  v_is_security boolean := false;
  v_now timestamptz := statement_timestamp();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select sm.school_id,sm.role='security' into v_school_id,v_is_security
    from public.school_memberships sm where sm.user_id=v_user_id and sm.status='active'
   order by sm.created_at limit 1;
  if v_school_id is null then raise exception 'Active school membership required' using errcode = '42501'; end if;
  return query
  select hp.id,hp.school_id,hp.student_id,st.student_number,concat_ws(' ',st.first_name,st.last_name),
         hp.origin,hp.destination,hp.reason,hp.status,
         case when hp.status='active' and hp.approved_at is not null
                   and hp.approved_at+make_interval(mins=>hp.expected_duration_minutes)<=v_now
              then 'overdue' else hp.status end,
         hp.requested_at,hp.approved_at,
         case when hp.approved_at is not null then hp.approved_at+make_interval(mins=>hp.expected_duration_minutes) else null end,
         hp.expected_duration_minutes,hp.returned_at,hp.ended_at,hp.end_reason,v_now
    from public.hall_passes hp join public.students st on st.id=hp.student_id and st.school_id=hp.school_id
   where hp.school_id=v_school_id
     and (v_is_security or private.can_access_student(hp.school_id,hp.student_id))
   order by hp.requested_at desc limit 500;
end;
$$;
revoke all on function public.get_school_hall_pass_monitor() from public, anon;
grant execute on function public.get_school_hall_pass_monitor() to authenticated;

create or replace function public.get_school_pass_students()
returns table (
  student_id uuid, student_number text, first_name text, last_name text, grade_level text, homeroom text
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_school_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select sm.school_id into v_school_id from public.school_memberships sm
   where sm.user_id=v_user_id and sm.status='active' order by sm.created_at limit 1;
  if v_school_id is null then raise exception 'Active school membership required' using errcode='42501'; end if;
  return query select st.id,st.student_number,st.first_name,st.last_name,st.grade_level,st.homeroom
    from public.students st where st.school_id=v_school_id and st.status='active'
      and private.can_access_student(st.school_id,st.id)
    order by st.last_name,st.first_name limit 2000;
end;
$$;
revoke all on function public.get_school_pass_students() from public, anon;
grant execute on function public.get_school_pass_students() to authenticated;

create or replace function public.request_school_hall_pass(
  p_student_id uuid,p_origin text,p_destination text,p_reason text,p_duration_minutes integer default 10
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_school_id uuid; v_pass_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select sm.school_id into v_school_id from public.school_memberships sm
   where sm.user_id=v_user_id and sm.status='active' order by sm.created_at limit 1;
  if v_school_id is null then raise exception 'Active school membership required' using errcode='42501'; end if;
  if not private.can_access_student(v_school_id,p_student_id) then
    raise exception 'You cannot request a pass for this student' using errcode='42501';
  end if;
  if p_duration_minutes is null or p_duration_minutes<1 or p_duration_minutes>120 then
    raise exception 'Pass duration must be between 1 and 120 minutes' using errcode='22023';
  end if;
  if nullif(btrim(p_destination),'') is null or length(p_destination)>100 then
    raise exception 'A destination of 1 to 100 characters is required' using errcode='22023';
  end if;
  insert into public.hall_passes(school_id,student_id,requested_by,origin,destination,reason,expected_duration_minutes,status)
  values(v_school_id,p_student_id,v_user_id,nullif(left(btrim(coalesce(p_origin,'')),100),''),btrim(p_destination),
         nullif(left(btrim(coalesce(p_reason,'')),500),''),p_duration_minutes,'pending')
  returning id into v_pass_id;
  return v_pass_id;
end;
$$;
revoke all on function public.request_school_hall_pass(uuid,text,text,text,integer) from public, anon;
grant execute on function public.request_school_hall_pass(uuid,text,text,text,integer) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hall_passes') then
    alter publication supabase_realtime add table public.hall_passes;
  end if;
end;
$$;


-- Keep SECURITY DEFINER implementation functions in the non-exposed private schema.
-- Public RPC endpoints are SECURITY INVOKER wrappers with explicit authenticated grants.
alter function public.get_school_hall_pass_monitor() set schema private;
alter function public.get_school_pass_students() set schema private;
alter function public.request_school_hall_pass(uuid,text,text,text,integer) set schema private;
alter function public.security_list_school_passes() set schema private;

revoke all on function private.get_school_hall_pass_monitor() from public,anon;
revoke all on function private.get_school_pass_students() from public,anon;
revoke all on function private.request_school_hall_pass(uuid,text,text,text,integer) from public,anon;
revoke all on function private.security_list_school_passes() from public,anon;
grant execute on function private.get_school_hall_pass_monitor() to authenticated;
grant execute on function private.get_school_pass_students() to authenticated;
grant execute on function private.request_school_hall_pass(uuid,text,text,text,integer) to authenticated;
grant execute on function private.security_list_school_passes() to authenticated;

create or replace function public.get_school_hall_pass_monitor()
returns table (
  pass_id uuid, school_id uuid, student_id uuid, student_number text, student_name text,
  origin text, destination text, reason text, status text, display_status text,
  requested_at timestamptz, approved_at timestamptz, expires_at timestamptz,
  expected_duration_minutes integer, returned_at timestamptz, ended_at timestamptz,
  end_reason text, server_now timestamptz
)
language sql stable security invoker set search_path = ''
as $$ select * from private.get_school_hall_pass_monitor(); $$;

create or replace function public.get_school_pass_students()
returns table (
  student_id uuid, student_number text, first_name text, last_name text, grade_level text, homeroom text
)
language sql stable security invoker set search_path = ''
as $$ select * from private.get_school_pass_students(); $$;

create or replace function public.request_school_hall_pass(
  p_student_id uuid,p_origin text,p_destination text,p_reason text,p_duration_minutes integer default 10
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.request_school_hall_pass(p_student_id,p_origin,p_destination,p_reason,p_duration_minutes); $$;

create or replace function public.security_list_school_passes()
returns table (
  pass_id uuid, student_id uuid, student_number text, student_name text,
  origin text, destination text, reason text, status text, requested_at timestamptz,
  expected_duration_minutes integer, ended_at timestamptz, end_reason text
)
language sql stable security invoker set search_path = ''
as $$ select * from private.security_list_school_passes(); $$;

alter function public.get_pilot_server_time() security invoker;

revoke all on function public.get_school_hall_pass_monitor() from public,anon;
revoke all on function public.get_school_pass_students() from public,anon;
revoke all on function public.request_school_hall_pass(uuid,text,text,text,integer) from public,anon;
revoke all on function public.security_list_school_passes() from public,anon;
grant execute on function public.get_school_hall_pass_monitor() to authenticated;
grant execute on function public.get_school_pass_students() to authenticated;
grant execute on function public.request_school_hall_pass(uuid,text,text,text,integer) to authenticated;
grant execute on function public.security_list_school_passes() to authenticated;
