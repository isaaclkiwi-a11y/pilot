create or replace function private.start_school_kiosk_pass(p_student_number text,p_destination text,p_duration_minutes integer)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_school_id uuid; v_student public.students%rowtype; v_pass public.hall_passes%rowtype;
begin
 v_school_id:=private.kiosk_school_id();
 perform private.enforce_kiosk_rate_limit(v_school_id);
 if p_student_number is null or char_length(btrim(p_student_number))<1 then raise exception 'Enter a student number.'; end if;
 if p_destination is null or char_length(btrim(p_destination))<1 or char_length(btrim(p_destination))>120 then raise exception 'Choose a valid destination.'; end if;
 if p_duration_minutes<1 or p_duration_minutes>120 then raise exception 'Pass duration must be between 1 and 120 minutes.'; end if;
 select student.* into v_student from public.students student
 where student.school_id=v_school_id and student.student_number=btrim(p_student_number) and student.status='active'
 limit 1;
 if not found then raise exception 'Student number not found. Ask the office for help.'; end if;
 if exists(select 1 from public.hall_passes pass where pass.school_id=v_school_id and pass.student_id=v_student.id and pass.status in ('active','pending')) then
  raise exception 'This student already has a pending or active hall pass.';
 end if;
 insert into public.hall_passes(school_id,student_id,requested_by,origin,destination,reason,status,expected_duration_minutes)
 values(v_school_id,v_student.id,(select auth.uid()),v_student.homeroom,btrim(p_destination),'School kiosk','pending',p_duration_minutes)
 returning * into v_pass;
 update private.school_kiosk_attempts set succeeded=true
 where actor_user_id=(select auth.uid()) and school_id=v_school_id and id=(select max(id) from private.school_kiosk_attempts where actor_user_id=(select auth.uid()));
 return jsonb_build_object('success',true,'status','pending','student_name',v_student.first_name||' '||v_student.last_name,'destination',v_pass.destination);
end;
$function$;