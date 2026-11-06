create table if not exists public.school_bell_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  effective_from date,
  effective_to date,
  days_of_week smallint[] not null default array[1,2,3,4,5]::smallint[],
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  check (cardinality(days_of_week) between 1 and 7),
  unique(id,school_id)
);
create unique index if not exists school_bell_schedules_one_default_idx on public.school_bell_schedules(school_id) where is_default and status='active';
create index if not exists school_bell_schedules_school_status_idx on public.school_bell_schedules(school_id,status);

create table if not exists public.school_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  schedule_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  period_order integer not null check (period_order between 1 and 30),
  starts_at time not null,
  ends_at time not null,
  period_type text not null default 'class' check (period_type in ('class','passing','lunch','advisory','assembly','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique(schedule_id,period_order),
  unique(id,school_id),
  foreign key(schedule_id,school_id) references public.school_bell_schedules(id,school_id) on delete cascade
);
create index if not exists school_periods_schedule_order_idx on public.school_periods(schedule_id,period_order);

create table if not exists public.school_class_meetings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  period_id uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_on date,
  ends_on date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(class_id,school_id) references public.school_classes(id,school_id) on delete cascade,
  foreign key(period_id,school_id) references public.school_periods(id,school_id) on delete cascade,
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  unique(class_id,period_id,day_of_week,starts_on)
);
create index if not exists school_class_meetings_class_day_idx on public.school_class_meetings(school_id,class_id,day_of_week);
create index if not exists school_class_meetings_period_idx on public.school_class_meetings(school_id,period_id);

create table if not exists public.substitute_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_user_id uuid not null,
  substitute_user_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active','ended','cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  ended_by uuid references auth.users(id),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (teacher_user_id <> substitute_user_id),
  check (ends_on >= starts_on),
  foreign key(school_id,teacher_user_id) references public.school_memberships(school_id,user_id) on delete cascade,
  foreign key(school_id,substitute_user_id) references public.school_memberships(school_id,user_id) on delete cascade
);
create index if not exists substitute_assignments_teacher_dates_idx on public.substitute_assignments(school_id,teacher_user_id,starts_on,ends_on) where status='active';
create index if not exists substitute_assignments_sub_dates_idx on public.substitute_assignments(school_id,substitute_user_id,starts_on,ends_on) where status='active';

create or replace function private.can_access_class(p_school_id uuid,p_class_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select
   private.has_school_role(p_school_id,array['owner','school_admin','staff_admin']::text[])
   or exists (
     select 1 from public.class_staff_assignments assignment
     join public.school_memberships membership on membership.school_id=assignment.school_id
      and membership.user_id=assignment.user_id and membership.status='active'
      and membership.role=any(array['teacher','staff']::text[])
     where assignment.school_id=p_school_id and assignment.class_id=p_class_id
       and assignment.user_id=(select auth.uid())
   )
   or exists (
     select 1 from public.substitute_assignments coverage
     join public.school_memberships substitute_membership on substitute_membership.school_id=coverage.school_id
      and substitute_membership.user_id=coverage.substitute_user_id
      and substitute_membership.status='active'
      and substitute_membership.role=any(array['teacher','staff','substitute']::text[])
     join public.class_staff_assignments original_assignment on original_assignment.school_id=coverage.school_id
      and original_assignment.class_id=p_class_id and original_assignment.user_id=coverage.teacher_user_id
     join public.schools school on school.id=coverage.school_id
     where coverage.school_id=p_school_id and coverage.substitute_user_id=(select auth.uid())
       and coverage.status='active'
       and (now() at time zone school.timezone)::date between coverage.starts_on and coverage.ends_on
   );
$function$;

create or replace function private.can_access_student(p_school_id uuid,p_student_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select
   private.has_school_role(p_school_id,array['owner','school_admin','staff_admin']::text[])
   or exists (select 1 from public.students student where student.id=p_student_id
     and student.school_id=p_school_id and student.auth_user_id=(select auth.uid())
     and private.has_school_role(p_school_id,array['student']::text[]))
   or exists (select 1 from public.class_enrollments enrollment where enrollment.school_id=p_school_id
     and enrollment.student_id=p_student_id and private.can_access_class(p_school_id,enrollment.class_id));
$function$;

create or replace function private.can_manage_student(p_school_id uuid,p_student_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select private.has_school_role(p_school_id,array['owner','school_admin','staff_admin']::text[])
   or exists (select 1 from public.class_enrollments enrollment where enrollment.school_id=p_school_id
     and enrollment.student_id=p_student_id and private.can_access_class(p_school_id,enrollment.class_id));
$function$;

alter table public.school_bell_schedules enable row level security;
alter table public.school_periods enable row level security;
alter table public.school_class_meetings enable row level security;
alter table public.substitute_assignments enable row level security;

drop policy if exists "School members can read bell schedules" on public.school_bell_schedules;
create policy "School members can read bell schedules" on public.school_bell_schedules for select to authenticated using (private.has_school_role(school_id));
drop policy if exists "Admins manage bell schedules" on public.school_bell_schedules;
create policy "Admins manage bell schedules" on public.school_bell_schedules for all to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
drop policy if exists "School members can read periods" on public.school_periods;
create policy "School members can read periods" on public.school_periods for select to authenticated using (private.has_school_role(school_id));
drop policy if exists "Admins manage periods" on public.school_periods;
create policy "Admins manage periods" on public.school_periods for all to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
drop policy if exists "Authorized users can read class meetings" on public.school_class_meetings;
create policy "Authorized users can read class meetings" on public.school_class_meetings for select to authenticated using (
 private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]) or private.can_access_class(school_id,class_id)
 or exists(select 1 from public.class_enrollments enrollment join public.students student on student.id=enrollment.student_id and student.school_id=enrollment.school_id where enrollment.school_id=school_class_meetings.school_id and enrollment.class_id=school_class_meetings.class_id and student.auth_user_id=(select auth.uid()))
);
drop policy if exists "Admins manage class meetings" on public.school_class_meetings;
create policy "Admins manage class meetings" on public.school_class_meetings for all to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]));
drop policy if exists "Related staff can read substitute assignments" on public.substitute_assignments;
create policy "Related staff can read substitute assignments" on public.substitute_assignments for select to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]) or teacher_user_id=(select auth.uid()) or substitute_user_id=(select auth.uid()));
drop policy if exists "Admins manage substitute assignments" on public.substitute_assignments;
create policy "Admins manage substitute assignments" on public.substitute_assignments for all to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])) with check (
 private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[])
 and exists(select 1 from public.school_memberships teacher where teacher.school_id=substitute_assignments.school_id and teacher.user_id=substitute_assignments.teacher_user_id and teacher.status='active' and teacher.role='teacher')
 and exists(select 1 from public.school_memberships substitute where substitute.school_id=substitute_assignments.school_id and substitute.user_id=substitute_assignments.substitute_user_id and substitute.status='active' and substitute.role in ('teacher','staff','substitute'))
);
drop policy if exists "Members can view classes in their school scope" on public.school_classes;
create policy "Members can view classes in their school scope" on public.school_classes for select to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]) or private.can_access_class(school_id,id));
drop policy if exists "Staff can view their class assignments" on public.class_staff_assignments;
create policy "Staff can view their class assignments" on public.class_staff_assignments for select to authenticated using (private.has_school_role(school_id,array['owner','school_admin','staff_admin']::text[]) or private.can_access_class(school_id,class_id));

revoke all on public.school_bell_schedules,public.school_periods,public.school_class_meetings,public.substitute_assignments from anon;
grant select,insert,update,delete on public.school_bell_schedules,public.school_periods,public.school_class_meetings,public.substitute_assignments to authenticated;
revoke all on function private.can_access_class(uuid,uuid) from public,anon;
grant execute on function private.can_access_class(uuid,uuid) to authenticated;
revoke all on function private.can_access_student(uuid,uuid),private.can_manage_student(uuid,uuid) from public,anon;
grant execute on function private.can_access_student(uuid,uuid),private.can_manage_student(uuid,uuid) to authenticated;
