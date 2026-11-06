alter table public.school_memberships drop constraint if exists school_memberships_role_check;
alter table public.school_memberships add constraint school_memberships_role_check
 check (role = any(array['owner','school_admin','staff_admin','teacher','staff','security','student','substitute','kiosk']::text[]));
alter table public.staff_invites drop constraint if exists staff_invites_role_check;
alter table public.staff_invites add constraint staff_invites_role_check
 check (role = any(array['teacher','staff','security','substitute','kiosk']::text[]));

create table if not exists private.school_kiosk_attempts (
 id bigint generated always as identity primary key,
 school_id uuid not null references public.schools(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id) on delete cascade,
 attempted_at timestamptz not null default now(),
 succeeded boolean not null default false
);
create index if not exists school_kiosk_attempts_actor_time_idx on private.school_kiosk_attempts(actor_user_id,attempted_at desc);
revoke all on private.school_kiosk_attempts from public,anon,authenticated;

create or replace function private.kiosk_school_id()
returns uuid language plpgsql stable security definer set search_path=''
as $function$
declare v_school_id uuid;
begin
 select membership.school_id into v_school_id from public.school_memberships membership
 where membership.user_id=(select auth.uid()) and membership.status='active' and membership.role='kiosk' limit 1;
 if v_school_id is null then raise exception 'This account is not authorized for kiosk mode.'; end if;
 return v_school_id;
end;
$function$;

create or replace function private.enforce_kiosk_rate_limit(p_school_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text,0));
 select count(*) into v_count from private.school_kiosk_attempts where actor_user_id=(select auth.uid()) and attempted_at>now()-interval '1 minute';
 if v_count>=120 then raise exception 'Kiosk is temporarily rate limited. Please wait and try again.'; end if;
 insert into private.school_kiosk_attempts(school_id,actor_user_id,succeeded) values(p_school_id,(select auth.uid()),false);
end;
$function$;

create or replace function private.get_school_kiosk_student(p_student_number text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_school_id uuid; v_student public.students%rowtype; v_pass public.hall_passes%rowtype;
begin
 v_school_id:=private.kiosk_school_id(); perform private.enforce_kiosk_rate_limit(v_school_id);
 if p_student_number is null or char_length(btrim(p_student_number))<1 or char_length(btrim(p_student_number))>80 then return jsonb_build_object('found',false); end if;
 select student.* into v_student from public.students student where student.school_id=v_school_id and student.student_number=btrim(p_student_number) and student.status='active' limit 1;
 if not found then return jsonb_build_object('found',false); end if;
 select pass.* into v_pass from public.hall_passes pass where pass.school_id=v_school_id and pass.student_id=v_student.id and pass.status in ('active','pending') order by pass.requested_at desc limit 1;
 update private.school_kiosk_attempts set succeeded=true where actor_user_id=(select auth.uid()) and school_id=v_school_id and id=(select max(id) from private.school_kiosk_attempts where actor_user_id=(select auth.uid()));
 return jsonb_build_object('found',true,'student',jsonb_build_object('id',v_student.id,'student_number',v_student.student_number,'first_name',v_student.first_name,'last_name',v_student.last_name,'grade_level',v_student.grade_level,'homeroom',v_student.homeroom),'pass',case when v_pass.id is null then null else jsonb_build_object('id',v_pass.id,'destination',v_pass.destination,'status',v_pass.status,'requested_at',v_pass.requested_at,'approved_at',v_pass.approved_at,'expected_duration_minutes',v_pass.expected_duration_minutes) end);
end;
$function$;

create or replace function private.start_school_kiosk_pass(p_student_number text,p_destination text,p_duration_minutes integer)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_school_id uuid; v_student public.students%rowtype; v_pass public.hall_passes%rowtype;
begin
 v_school_id:=private.kiosk_school_id(); perform private.enforce_kiosk_rate_limit(v_school_id);
 if p_student_number is null or char_length(btrim(p_student_number))<1 then raise exception 'Enter a student number.'; end if;
 if p_destination is null or char_length(btrim(p_destination))<1 or char_length(btrim(p_destination))>120 then raise exception 'Choose a valid destination.'; end if;
 if p_duration_minutes<1 or p_duration_minutes>120 then raise exception 'Pass duration must be between 1 and 120 minutes.'; end if;
 select student.* into v_student from public.students student where student.school_id=v_school_id and student.student_number=btrim(p_student_number) and student.status='active' limit 1;
 if not found then raise exception 'Student number not found. Ask the office for help.'; end if;
 if exists(select 1 from public.hall_passes pass where pass.school_id=v_school_id and pass.student_id=v_student.id and pass.status in ('active','pending')) then raise exception 'This student already has a pending or active hall pass.'; end if;
 insert into public.hall_passes(school_id,student_id,requested_by,origin,destination,reason,status,expected_duration_minutes)
 values(v_school_id,v_student.id,(select auth.uid()),v_student.homeroom,btrim(p_destination),'School kiosk','pending',p_duration_minutes)
 returning * into v_pass;
 update public.hall_passes set status='active' where id=v_pass.id returning * into v_pass;
 update private.school_kiosk_attempts set succeeded=true where actor_user_id=(select auth.uid()) and school_id=v_school_id and id=(select max(id) from private.school_kiosk_attempts where actor_user_id=(select auth.uid()));
 return jsonb_build_object('success',true,'student_name',v_student.first_name||' '||v_student.last_name,'destination',v_pass.destination,'expires_at',v_pass.approved_at+make_interval(mins=>v_pass.expected_duration_minutes));
end;
$function$;

create or replace function private.end_school_kiosk_pass(p_student_number text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_school_id uuid; v_student public.students%rowtype; v_pass public.hall_passes%rowtype;
begin
 v_school_id:=private.kiosk_school_id(); perform private.enforce_kiosk_rate_limit(v_school_id);
 select student.* into v_student from public.students student where student.school_id=v_school_id and student.student_number=btrim(coalesce(p_student_number,'')) and student.status='active' limit 1;
 if not found then raise exception 'Student number not found. Ask the office for help.'; end if;
 select pass.* into v_pass from public.hall_passes pass where pass.school_id=v_school_id and pass.student_id=v_student.id and pass.status='active' order by pass.requested_at desc limit 1;
 if not found then raise exception 'There is no active pass to end.'; end if;
 update public.hall_passes set status='returned',returned_at=now(),ended_at=now(),ended_by=(select auth.uid()),end_reason='Ended at school kiosk' where id=v_pass.id;
 update private.school_kiosk_attempts set succeeded=true where actor_user_id=(select auth.uid()) and school_id=v_school_id and id=(select max(id) from private.school_kiosk_attempts where actor_user_id=(select auth.uid()));
 return jsonb_build_object('success',true,'student_name',v_student.first_name||' '||v_student.last_name);
end;
$function$;

create or replace function public.get_school_kiosk_student(p_student_number text)
returns jsonb language sql security definer set search_path=''
as $function$ select private.get_school_kiosk_student(p_student_number); $function$;
create or replace function public.start_school_kiosk_pass(p_student_number text,p_destination text,p_duration_minutes integer)
returns jsonb language sql security definer set search_path=''
as $function$ select private.start_school_kiosk_pass(p_student_number,p_destination,p_duration_minutes); $function$;
create or replace function public.end_school_kiosk_pass(p_student_number text)
returns jsonb language sql security definer set search_path=''
as $function$ select private.end_school_kiosk_pass(p_student_number); $function$;

revoke all on function private.kiosk_school_id(),private.enforce_kiosk_rate_limit(uuid),private.get_school_kiosk_student(text),private.start_school_kiosk_pass(text,text,integer),private.end_school_kiosk_pass(text) from public,anon,authenticated;
revoke all on function public.get_school_kiosk_student(text),public.start_school_kiosk_pass(text,text,integer),public.end_school_kiosk_pass(text) from public,anon;
grant execute on function public.get_school_kiosk_student(text),public.start_school_kiosk_pass(text,text,integer),public.end_school_kiosk_pass(text) to authenticated;
