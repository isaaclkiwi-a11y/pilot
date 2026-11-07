-- Security approvals, named staff invitations, and student QR credentials.
alter table public.staff_invites add column if not exists display_name text;
alter table public.staff_invites drop constraint if exists staff_invites_display_name_length;
alter table public.staff_invites add constraint staff_invites_display_name_length check(display_name is null or char_length(btrim(display_name)) between 2 and 120);

create or replace function private.accept_staff_invite(p_token text)
returns table(school_id uuid,role text) language plpgsql security definer set search_path=''
as $function$
#variable_conflict use_column
declare v_user_id uuid:=auth.uid();v_email text;v_hash text;v_invite public.staff_invites%rowtype;
begin
 if v_user_id is null then raise exception 'Sign in or create your staff account first';end if;
 if p_token is null or char_length(p_token)<32 or char_length(p_token)>160 then raise exception 'This invitation link is invalid';end if;
 select lower(u.email) into v_email from auth.users u where u.id=v_user_id;
 v_hash:=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
 select si.* into v_invite from public.staff_invites si where si.token_hash=v_hash and lower(si.email)=v_email and si.accepted_at is null and si.revoked_at is null and si.expires_at>now() for update;
 if not found then raise exception 'This invitation is invalid, expired, already used, or belongs to a different email address';end if;
 if exists(select 1 from public.school_memberships sm where sm.school_id=v_invite.school_id and sm.user_id=v_user_id) then raise exception 'This account is already a member of this school';end if;
 insert into public.school_memberships(school_id,user_id,role,status) values(v_invite.school_id,v_user_id,v_invite.role,'active');
 insert into public.school_staff_profiles(school_id,user_id,display_name,job_title,status,created_by,updated_at)
 values(v_invite.school_id,v_user_id,coalesce(nullif(btrim(v_invite.display_name),''),v_email),v_invite.role,'active',v_invite.invited_by,now())
 on conflict(school_id,user_id) do update set
  display_name=coalesce(nullif(btrim(excluded.display_name),''),public.school_staff_profiles.display_name),
  job_title=excluded.job_title,status='active',updated_at=now();
 update public.staff_invites set accepted_at=now() where id=v_invite.id;
 return query select v_invite.school_id,v_invite.role;
end;$function$;

create or replace function private.security_approve_hall_pass(p_pass_id uuid)
returns public.hall_passes language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid:=auth.uid();v_school_id uuid;v_pass public.hall_passes%rowtype;
begin
 if v_user_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 select school_id into v_school_id from public.hall_passes where id=p_pass_id for update;
 if v_school_id is null then raise exception 'Pass not found' using errcode='P0002';end if;
 if not private.has_school_role(v_school_id,array['security']::text[]) then raise exception 'Security role required for this school' using errcode='42501';end if;
 update public.hall_passes set status='active',approved_by=v_user_id,approved_at=now(),updated_at=now()
 where id=p_pass_id and school_id=v_school_id and status='pending' returning * into v_pass;
 if not found then raise exception 'Only pending passes can be approved' using errcode='22023';end if;
 return v_pass;
end;$function$;
revoke all on function private.security_approve_hall_pass(uuid) from public,anon;
grant execute on function private.security_approve_hall_pass(uuid) to authenticated;
create or replace function public.security_approve_hall_pass(p_pass_id uuid)
returns public.hall_passes language sql security invoker set search_path=''
as $function$ select private.security_approve_hall_pass(p_pass_id); $function$;
revoke all on function public.security_approve_hall_pass(uuid) from public,anon;
grant execute on function public.security_approve_hall_pass(uuid) to authenticated;

create table if not exists private.student_qr_login_attempts(id bigint generated always as identity primary key,attempt_key text not null,attempted_at timestamptz not null default now());
create index if not exists student_qr_login_attempts_key_time_idx on private.student_qr_login_attempts(attempt_key,attempted_at desc);
revoke all on private.student_qr_login_attempts from public,anon,authenticated;

create or replace function private.issue_student_qr_credential(p_student_id uuid,p_auth_user_id uuid,p_token text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid:=auth.uid();v_school_id uuid;v_role text;v_credential_id uuid;v_expires_at timestamptz:=now()+interval '365 days';
begin
 if v_user_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_token is null or char_length(p_token)<48 or char_length(p_token)>160 then raise exception 'Invalid credential token';end if;
 select school_id into v_school_id from public.students where id=p_student_id and status='active' for update;
 if v_school_id is null then raise exception 'Active student not found';end if;
 if not private.has_school_role(v_school_id,array['owner','school_admin','staff_admin']::text[]) then raise exception 'School administrator access required' using errcode='42501';end if;
 if not exists(select 1 from auth.users where id=p_auth_user_id) then raise exception 'Student authentication account was not created';end if;
 select role into v_role from public.school_memberships where school_id=v_school_id and user_id=p_auth_user_id;
 if v_role is not null and v_role<>'student' then raise exception 'Linked account already has a non-student role';end if;
 update public.students set auth_user_id=p_auth_user_id,updated_at=now() where id=p_student_id and school_id=v_school_id;
 insert into public.school_memberships(school_id,user_id,role,status) values(v_school_id,p_auth_user_id,'student','active')
 on conflict(school_id,user_id) do update set role='student',status='active',updated_at=now();
 update public.student_qr_credentials set revoked_at=now() where student_id=p_student_id and school_id=v_school_id and revoked_at is null;
 insert into public.student_qr_credentials(school_id,student_id,token_hash,created_by,expires_at)
 values(v_school_id,p_student_id,encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex'),v_user_id,v_expires_at) returning id into v_credential_id;
 return jsonb_build_object('credential_id',v_credential_id,'expires_at',v_expires_at);
end;$function$;
revoke all on function private.issue_student_qr_credential(uuid,uuid,text) from public,anon;
grant execute on function private.issue_student_qr_credential(uuid,uuid,text) to authenticated;
create or replace function public.issue_student_qr_credential(p_student_id uuid,p_auth_user_id uuid,p_token text)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.issue_student_qr_credential(p_student_id,p_auth_user_id,p_token); $function$;
revoke all on function public.issue_student_qr_credential(uuid,uuid,text) from public,anon;
grant execute on function public.issue_student_qr_credential(uuid,uuid,text) to authenticated;

create or replace function private.list_student_qr_credentials()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_school_id uuid;v_result jsonb;
begin
 select school_id into v_school_id from public.school_memberships where user_id=(select auth.uid()) and status='active' and role=any(array['owner','school_admin','staff_admin']::text[]) limit 1;
 if v_school_id is null then raise exception 'School administrator access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'student_id',c.student_id,'student_name',concat_ws(' ',s.first_name,s.last_name),'student_number',s.student_number,'expires_at',c.expires_at,'revoked_at',c.revoked_at,'last_used_at',c.last_used_at,'created_at',c.created_at) order by c.created_at desc),'[]'::jsonb)
 into v_result from public.student_qr_credentials c join public.students s on s.id=c.student_id and s.school_id=c.school_id where c.school_id=v_school_id;
 return v_result;
end;$function$;
revoke all on function private.list_student_qr_credentials() from public,anon;
grant execute on function private.list_student_qr_credentials() to authenticated;
create or replace function public.list_student_qr_credentials()
returns jsonb language sql security invoker set search_path=''
as $function$ select private.list_student_qr_credentials(); $function$;
revoke all on function public.list_student_qr_credentials() from public,anon;
grant execute on function public.list_student_qr_credentials() to authenticated;

create or replace function private.revoke_student_qr_credential(p_credential_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_school_id uuid;
begin
 select school_id into v_school_id from public.student_qr_credentials where id=p_credential_id for update;
 if v_school_id is null then raise exception 'Credential not found';end if;
 if not private.has_school_role(v_school_id,array['owner','school_admin','staff_admin']::text[]) then raise exception 'School administrator access required' using errcode='42501';end if;
 update public.student_qr_credentials set revoked_at=coalesce(revoked_at,now()) where id=p_credential_id and school_id=v_school_id;
end;$function$;
revoke all on function private.revoke_student_qr_credential(uuid) from public,anon;
grant execute on function private.revoke_student_qr_credential(uuid) to authenticated;
create or replace function public.revoke_student_qr_credential(p_credential_id uuid)
returns void language sql security invoker set search_path=''
as $function$ select private.revoke_student_qr_credential(p_credential_id); $function$;
revoke all on function public.revoke_student_qr_credential(uuid) from public,anon;
grant execute on function public.revoke_student_qr_credential(uuid) to authenticated;

create or replace function private.get_student_qr_login_email(p_token text)
returns text language plpgsql security definer set search_path=''
as $function$
declare v_email text;v_ip text;v_key text;v_count integer;
begin
 if p_token is null or char_length(p_token)<48 or char_length(p_token)>160 then raise exception 'Invalid or expired student QR credential';end if;
 v_ip:=nullif(split_part(coalesce(current_setting('request.headers',true)::json->>'x-forwarded-for',''),',',1),'');
 if v_ip is not null then
  v_key:=encode(extensions.digest(convert_to(v_ip,'UTF8'),'sha256'),'hex');perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select count(*) into v_count from private.student_qr_login_attempts where attempt_key=v_key and attempted_at>now()-interval '1 minute';
  if v_count>=30 then raise exception 'Too many QR login attempts. Wait a minute and try again';end if;
  insert into private.student_qr_login_attempts(attempt_key) values(v_key);
 end if;
 select u.email into v_email from public.student_qr_credentials c join public.students s on s.id=c.student_id and s.school_id=c.school_id join auth.users u on u.id=s.auth_user_id
 where c.token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex') and c.revoked_at is null and (c.expires_at is null or c.expires_at>now()) and s.status='active'
 order by c.created_at desc limit 1;
 if v_email is null then raise exception 'Invalid or expired student QR credential';end if;
 update public.student_qr_credentials set last_used_at=now()
 where token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex') and revoked_at is null;
 return v_email;
end;$function$;
revoke all on function private.get_student_qr_login_email(text) from public,anon,authenticated;
create or replace function public.get_student_qr_login_email(p_token text)
returns text language sql security definer set search_path=''
as $function$ select private.get_student_qr_login_email(p_token); $function$;
revoke all on function public.get_student_qr_login_email(text) from public;
grant execute on function public.get_student_qr_login_email(text) to anon,authenticated;
create index if not exists student_qr_credentials_student_created_idx on public.student_qr_credentials(student_id,created_at desc);
