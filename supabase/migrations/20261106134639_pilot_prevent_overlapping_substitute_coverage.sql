create or replace function private.prevent_overlapping_substitute_coverage()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if new.status='active' then
  perform pg_advisory_xact_lock(hashtextextended(new.school_id::text || ':teacher:' || new.teacher_user_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(new.school_id::text || ':substitute:' || new.substitute_user_id::text,0));
  if exists (
   select 1 from public.substitute_assignments existing
   where existing.school_id=new.school_id and existing.id is distinct from new.id
    and existing.status='active'
    and daterange(existing.starts_on,existing.ends_on,'[]') && daterange(new.starts_on,new.ends_on,'[]')
    and (existing.teacher_user_id=new.teacher_user_id or existing.substitute_user_id=new.substitute_user_id)
  ) then
   raise exception 'The teacher or substitute already has overlapping active coverage dates.';
  end if;
 end if;
 return new;
end;
$function$;
drop trigger if exists prevent_overlapping_substitute_coverage on public.substitute_assignments;
create trigger prevent_overlapping_substitute_coverage
before insert or update of school_id,teacher_user_id,substitute_user_id,starts_on,ends_on,status
on public.substitute_assignments for each row execute function private.prevent_overlapping_substitute_coverage();
revoke all on function private.prevent_overlapping_substitute_coverage() from public,anon,authenticated;
