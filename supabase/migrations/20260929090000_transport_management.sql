-- Funda360 Transport Management
-- Domain 9: vehicles, drivers, routes, stops, learner assignments,
-- schedules and operational pickup/dropoff attendance.
-- Additive only. No changes to closed domains.

create type public.transport_vehicle_status as enum ('active','maintenance','inactive');
create type public.transport_driver_status as enum ('active','suspended','inactive');
create type public.transport_assignment_status as enum ('active','suspended','ended');
create type public.transport_trip_status as enum ('scheduled','boarding','in_progress','completed','cancelled');
create type public.transport_attendance_status as enum ('boarded','absent','picked_up','dropped_off','no_show');

create table public.transport_vehicles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  registration_number text not null check (char_length(trim(registration_number)) > 0),
  fleet_number text,
  make text,
  model text,
  year integer check (year is null or year between 1950 and 2100),
  capacity integer not null check (capacity > 0),
  status public.transport_vehicle_status not null default 'active',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index transport_vehicles_school_registration_key on public.transport_vehicles(school_id, lower(registration_number));
create index transport_vehicles_school_status_idx on public.transport_vehicles(school_id,status);

create table public.transport_drivers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  phone text,
  licence_number text,
  licence_expiry date,
  status public.transport_driver_status not null default 'active',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_driver_licence_expiry_valid check (licence_expiry is null or licence_expiry >= date '2000-01-01')
);

create index transport_drivers_school_status_idx on public.transport_drivers(school_id,status);
create index transport_drivers_employee_idx on public.transport_drivers(employee_id);
create unique index transport_drivers_school_licence_key on public.transport_drivers(school_id, licence_number) where licence_number is not null;

create table public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  code text not null check (char_length(trim(code)) > 0),
  direction text not null default 'morning' check (direction in ('morning','afternoon','both')),
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index transport_routes_school_code_key on public.transport_routes(school_id, lower(code));
create index transport_routes_school_active_idx on public.transport_routes(school_id,active);

create table public.transport_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  pickup_time time,
  dropoff_time time,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_stops_latitude_valid check (latitude is null or latitude between -90 and 90),
  constraint transport_stops_longitude_valid check (longitude is null or longitude between -180 and 180)
);

create index transport_stops_school_active_idx on public.transport_stops(school_id,active);

create table public.transport_route_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  stop_id uuid not null references public.transport_stops(id) on delete restrict,
  stop_order integer not null check (stop_order > 0),
  pickup_time time,
  dropoff_time time,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(route_id, stop_id),
  unique(route_id, stop_order)
);

create index transport_route_stops_school_idx on public.transport_route_stops(school_id);
create index transport_route_stops_route_order_idx on public.transport_route_stops(route_id,stop_order);

create table public.transport_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete restrict,
  pickup_stop_id uuid references public.transport_stops(id) on delete restrict,
  dropoff_stop_id uuid references public.transport_stops(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  status public.transport_assignment_status not null default 'active',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_assignment_dates_valid check (effective_to is null or effective_to >= effective_from)
);

create index transport_assignments_school_status_idx on public.transport_assignments(school_id,status);
create index transport_assignments_learner_idx on public.transport_assignments(learner_id,status);
create index transport_assignments_route_idx on public.transport_assignments(route_id,status);

create table public.transport_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  vehicle_id uuid not null references public.transport_vehicles(id) on delete restrict,
  driver_id uuid references public.transport_drivers(id) on delete restrict,
  service_date date not null,
  departure_time time,
  status public.transport_trip_status not null default 'scheduled',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(route_id, service_date)
);

create index transport_schedules_school_date_idx on public.transport_schedules(school_id,service_date);
create index transport_schedules_route_date_idx on public.transport_schedules(route_id,service_date);

create table public.transport_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  schedule_id uuid not null references public.transport_schedules(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  status public.transport_attendance_status not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  unique(schedule_id, learner_id)
);

create index transport_attendance_school_schedule_idx on public.transport_attendance(school_id,schedule_id);
create index transport_attendance_learner_idx on public.transport_attendance(learner_id,recorded_at desc);

-- ---------------------------------------------------------------------------
-- Shared timestamps / tenant validation.

create trigger transport_vehicles_set_updated_at before update on public.transport_vehicles for each row execute function public.set_updated_at();
create trigger transport_drivers_set_updated_at before update on public.transport_drivers for each row execute function public.set_updated_at();
create trigger transport_routes_set_updated_at before update on public.transport_routes for each row execute function public.set_updated_at();
create trigger transport_stops_set_updated_at before update on public.transport_stops for each row execute function public.set_updated_at();
create trigger transport_assignments_set_updated_at before update on public.transport_assignments for each row execute function public.set_updated_at();
create trigger transport_schedules_set_updated_at before update on public.transport_schedules for each row execute function public.set_updated_at();

create trigger transport_vehicles_set_created_updated_by before insert or update on public.transport_vehicles for each row execute function public.set_created_updated_by();
create trigger transport_drivers_set_created_updated_by before insert or update on public.transport_drivers for each row execute function public.set_created_updated_by();
create trigger transport_routes_set_created_updated_by before insert or update on public.transport_routes for each row execute function public.set_created_updated_by();
create trigger transport_stops_set_created_updated_by before insert or update on public.transport_stops for each row execute function public.set_created_updated_by();
create trigger transport_assignments_set_created_updated_by before insert or update on public.transport_assignments for each row execute function public.set_created_updated_by();
create trigger transport_schedules_set_created_updated_by before insert or update on public.transport_schedules for each row execute function public.set_created_updated_by();

create or replace function public.transport_validate_school_refs()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  if tg_table_name = 'transport_route_stops' then
    select school_id into v_school from public.transport_routes where id = new.route_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: route must belong to the same school'; end if;
    select school_id into v_school from public.transport_stops where id = new.stop_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: stop must belong to the same school'; end if;
  elsif tg_table_name = 'transport_assignments' then
    select school_id into v_school from public.learners where id = new.learner_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: learner must belong to the same school'; end if;
    select school_id into v_school from public.transport_routes where id = new.route_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: route must belong to the same school'; end if;
  elsif tg_table_name = 'transport_schedules' then
    select school_id into v_school from public.transport_routes where id = new.route_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: route must belong to the same school'; end if;
    select school_id into v_school from public.transport_vehicles where id = new.vehicle_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: vehicle must belong to the same school'; end if;
    if new.driver_id is not null then
      select school_id into v_school from public.transport_drivers where id = new.driver_id;
      if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: driver must belong to the same school'; end if;
    end if;
  elsif tg_table_name = 'transport_attendance' then
    select school_id into v_school from public.transport_schedules where id = new.schedule_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: schedule must belong to the same school'; end if;
    select school_id into v_school from public.learners where id = new.learner_id;
    if v_school is distinct from new.school_id then raise exception 'insufficient_privilege: learner must belong to the same school'; end if;
  end if;
  return new;
end; $$;

create trigger transport_route_stops_validate before insert or update on public.transport_route_stops for each row execute function public.transport_validate_school_refs();
create trigger transport_assignments_validate before insert or update on public.transport_assignments for each row execute function public.transport_validate_school_refs();
create trigger transport_schedules_validate before insert or update on public.transport_schedules for each row execute function public.transport_validate_school_refs();
create trigger transport_attendance_validate before insert or update on public.transport_attendance for each row execute function public.transport_validate_school_refs();

-- ---------------------------------------------------------------------------
-- Authorization.

create or replace function public.can_view_transport(target_school_id uuid)
returns boolean language sql stable as $$
  select (
    target_school_id = public.current_tenant_id()
    and coalesce(auth.jwt()->'app_metadata'->>'role','') in
      ('school_owner','principal','vice_principal','transport_coordinator','teacher','class_teacher','subject_teacher')
  ) or public.is_platform_admin();
$$;

create or replace function public.can_manage_transport(target_school_id uuid)
returns boolean language sql stable as $$
  select (
    target_school_id = public.current_tenant_id()
    and coalesce(auth.jwt()->'app_metadata'->>'role','') in
      ('school_owner','principal','transport_coordinator')
  ) or public.is_platform_admin();
$$;

grant execute on function public.can_view_transport(uuid) to authenticated;
grant execute on function public.can_manage_transport(uuid) to authenticated;
revoke execute on function public.can_view_transport(uuid) from public;
revoke execute on function public.can_manage_transport(uuid) from public;

-- FORCE RLS, fail closed. Parents/learners get narrowly scoped SELECT below.
do $$
declare t text;
begin
  foreach t in array array[
    'transport_vehicles','transport_drivers','transport_routes','transport_stops',
    'transport_route_stops','transport_assignments','transport_schedules','transport_attendance'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

create policy transport_vehicles_select on public.transport_vehicles for select to authenticated using (public.can_view_transport(school_id));
create policy transport_vehicles_insert on public.transport_vehicles for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_vehicles_update on public.transport_vehicles for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

create policy transport_drivers_select on public.transport_drivers for select to authenticated using (public.can_view_transport(school_id));
create policy transport_drivers_insert on public.transport_drivers for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_drivers_update on public.transport_drivers for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

create policy transport_routes_select on public.transport_routes for select to authenticated using (
  public.can_view_transport(school_id)
  or exists (select 1 from public.transport_assignments a where a.route_id = transport_routes.id and public.is_learner_guardian(a.learner_id))
  or exists (select 1 from public.transport_assignments a where a.route_id = transport_routes.id and public.is_learner_self(a.learner_id))
);
create policy transport_routes_insert on public.transport_routes for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_routes_update on public.transport_routes for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

create policy transport_stops_select on public.transport_stops for select to authenticated using (
  public.can_view_transport(school_id)
  or exists (select 1 from public.transport_assignments a where (a.pickup_stop_id = transport_stops.id or a.dropoff_stop_id = transport_stops.id) and public.is_learner_guardian(a.learner_id))
  or exists (select 1 from public.transport_assignments a where (a.pickup_stop_id = transport_stops.id or a.dropoff_stop_id = transport_stops.id) and public.is_learner_self(a.learner_id))
);
create policy transport_stops_insert on public.transport_stops for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_stops_update on public.transport_stops for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

create policy transport_route_stops_select on public.transport_route_stops for select to authenticated using (public.can_view_transport(school_id));
create policy transport_route_stops_insert on public.transport_route_stops for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_route_stops_update on public.transport_route_stops for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

create policy transport_assignments_select on public.transport_assignments for select to authenticated using (
  public.can_view_transport(school_id)
  or public.is_learner_guardian(learner_id)
  or public.is_learner_self(learner_id)
);
create policy transport_assignments_insert on public.transport_assignments for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_assignments_update on public.transport_assignments for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

create policy transport_schedules_select on public.transport_schedules for select to authenticated using (public.can_view_transport(school_id));
create policy transport_schedules_insert on public.transport_schedules for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_schedules_update on public.transport_schedules for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

create policy transport_attendance_select on public.transport_attendance for select to authenticated using (
  public.can_view_transport(school_id)
  or public.is_learner_guardian(learner_id)
  or public.is_learner_self(learner_id)
);
create policy transport_attendance_insert on public.transport_attendance for insert to authenticated with check (public.can_manage_transport(school_id));
create policy transport_attendance_update on public.transport_attendance for update to authenticated using (public.can_manage_transport(school_id)) with check (public.can_manage_transport(school_id));

-- ---------------------------------------------------------------------------
-- RPC workflow gates.

create or replace function public.set_transport_assignment_status(
  p_assignment_id uuid, p_status public.transport_assignment_status
) returns public.transport_assignments
language plpgsql security definer set search_path=public as $$
declare v_school uuid; v_result public.transport_assignments;
begin
  select school_id into v_school from public.transport_assignments where id=p_assignment_id;
  if v_school is null then raise exception 'not_found: transport assignment'; end if;
  if not public.can_manage_transport(v_school) then raise exception 'insufficient_privilege: cannot manage transport'; end if;
  update public.transport_assignments set status=p_status where id=p_assignment_id returning * into v_result;
  perform public.write_audit_log(v_school,'transport_assignment_status_changed', 'transport_assignments', p_assignment_id,
    null, jsonb_build_object('status',p_status));
  return v_result;
end; $$;
grant execute on function public.set_transport_assignment_status(uuid, public.transport_assignment_status) to authenticated;
revoke execute on function public.set_transport_assignment_status(uuid, public.transport_assignment_status) from public;

create or replace function public.record_transport_attendance(
  p_schedule_id uuid, p_learner_id uuid, p_status public.transport_attendance_status, p_notes text default null
) returns public.transport_attendance
language plpgsql security definer set search_path=public as $$
declare v_school uuid; v_result public.transport_attendance; v_guardian uuid;
begin
  select school_id into v_school from public.transport_schedules where id=p_schedule_id;
  if v_school is null then raise exception 'not_found: transport schedule'; end if;
  if not public.can_manage_transport(v_school) then raise exception 'insufficient_privilege: cannot manage transport'; end if;
  if not exists (
    select 1 from public.transport_assignments a
    where a.learner_id=p_learner_id and a.route_id=(select route_id from public.transport_schedules where id=p_schedule_id)
      and a.school_id=v_school and a.status='active'
      and a.effective_from <= (select service_date from public.transport_schedules where id=p_schedule_id)
      and (a.effective_to is null or a.effective_to >= (select service_date from public.transport_schedules where id=p_schedule_id))
  ) then raise exception 'validation_error: learner is not assigned to this route on this date'; end if;

  insert into public.transport_attendance(school_id,schedule_id,learner_id,status,recorded_by,notes)
  values(v_school,p_schedule_id,p_learner_id,p_status,auth.uid(),p_notes)
  on conflict(schedule_id,learner_id) do update set status=excluded.status,recorded_at=now(),recorded_by=auth.uid(),notes=excluded.notes
  returning * into v_result;

  select lg.guardian_profile_id into v_guardian
  from public.learner_guardians lg
  where lg.learner_id=p_learner_id and lg.active=true and lg.is_primary=true
  limit 1;

  if v_guardian is not null and p_status in ('picked_up','dropped_off','no_show') then
    perform public.create_notification(
      v_guardian,'transport_update','Transport update',
      case p_status
        when 'picked_up' then 'Your child has been picked up.'
        when 'dropped_off' then 'Your child has been dropped off.'
        else 'A transport no-show has been recorded. Please contact the school if needed.'
      end,
      v_school,'transport_attendance',v_result.id,'/parent/transport'
    );
  end if;

  perform public.write_audit_log(v_school,'transport_attendance_recorded','transport_attendance',v_result.id,
    null, jsonb_build_object('learner_id',p_learner_id,'status',p_status));
  return v_result;
end; $$;
grant execute on function public.record_transport_attendance(uuid,uuid,public.transport_attendance_status,text) to authenticated;
revoke execute on function public.record_transport_attendance(uuid,uuid,public.transport_attendance_status,text) from public;

create or replace function public.set_transport_trip_status(
  p_schedule_id uuid, p_status public.transport_trip_status
) returns public.transport_schedules
language plpgsql security definer set search_path=public as $$
declare v_school uuid; v_result public.transport_schedules;
begin
  select school_id into v_school from public.transport_schedules where id=p_schedule_id;
  if v_school is null then raise exception 'not_found: transport schedule'; end if;
  if not public.can_manage_transport(v_school) then raise exception 'insufficient_privilege: cannot manage transport'; end if;
  update public.transport_schedules set status=p_status where id=p_schedule_id returning * into v_result;
  perform public.write_audit_log(v_school,'transport_trip_status_changed','transport_schedules',p_schedule_id,
    jsonb_build_object('status',p_status));
  return v_result;
end; $$;
grant execute on function public.set_transport_trip_status(uuid, public.transport_trip_status) to authenticated;
revoke execute on function public.set_transport_trip_status(uuid, public.transport_trip_status) from public;

comment on table public.transport_vehicles is 'School transport fleet register. Operational status changes are audited by application workflow.';
comment on table public.transport_assignments is 'Learner-to-route transport entitlement with dated effective period and parent self-service visibility.';
comment on table public.transport_attendance is 'Per-trip learner transport attendance and pickup/dropoff evidence.';
