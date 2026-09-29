-- Funda360 Transport Operations hardening
-- Completes route-stop, learner assignment, trip roster/attendance and fee integration workflows.
-- Additive only.

create or replace function public.create_transport_assignment(
  p_school_id uuid,
  p_learner_id uuid,
  p_route_id uuid,
  p_pickup_stop_id uuid default null,
  p_dropoff_stop_id uuid default null,
  p_effective_from date default current_date,
  p_effective_to date default null,
  p_notes text default null
) returns public.transport_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.transport_assignments;
begin
  if not public.can_manage_transport(p_school_id) then
    raise exception 'insufficient_privilege: cannot manage transport';
  end if;
  if p_school_id <> public.current_tenant_id() and not public.is_platform_admin() then
    raise exception 'insufficient_privilege: wrong school';
  end if;
  if not exists (select 1 from public.learners where id=p_learner_id and school_id=p_school_id) then
    raise exception 'validation_error: learner does not belong to this school';
  end if;
  if not exists (select 1 from public.transport_routes where id=p_route_id and school_id=p_school_id and active) then
    raise exception 'validation_error: route is not active for this school';
  end if;
  if p_pickup_stop_id is not null and not exists (select 1 from public.transport_stops where id=p_pickup_stop_id and school_id=p_school_id and active) then
    raise exception 'validation_error: pickup stop is not active for this school';
  end if;
  if p_dropoff_stop_id is not null and not exists (select 1 from public.transport_stops where id=p_dropoff_stop_id and school_id=p_school_id and active) then
    raise exception 'validation_error: drop-off stop is not active for this school';
  end if;
  if exists (
    select 1 from public.transport_assignments a
    where a.learner_id=p_learner_id
      and a.status='active'
      and a.effective_from <= coalesce(p_effective_to, '9999-12-31'::date)
      and coalesce(a.effective_to,'9999-12-31'::date) >= p_effective_from
  ) then
    raise exception 'validation_error: learner already has an overlapping active transport assignment';
  end if;

  insert into public.transport_assignments(
    school_id,learner_id,route_id,pickup_stop_id,dropoff_stop_id,
    effective_from,effective_to,status,notes
  )
  values (
    p_school_id,p_learner_id,p_route_id,p_pickup_stop_id,p_dropoff_stop_id,
    p_effective_from,p_effective_to,'active',p_notes
  )
  returning * into v_result;

  perform public.write_audit_log(
    p_school_id,auth.uid(),'transport_assignment_created','transport_assignments',v_result.id,
    null,jsonb_build_object('learner_id',p_learner_id,'route_id',p_route_id)
  );
  return v_result;
end;
$$;

grant execute on function public.create_transport_assignment(uuid,uuid,uuid,uuid,uuid,date,date,text) to authenticated;
revoke execute on function public.create_transport_assignment(uuid,uuid,uuid,uuid,uuid,date,date,text) from public;

create or replace function public.list_transport_learners(p_school_id uuid)
returns table(id uuid, learner_number text, first_name text, last_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_transport(p_school_id) then
    raise exception 'insufficient_privilege: cannot manage transport';
  end if;
  return query
    select l.id,l.learner_number,l.first_name,l.last_name
    from public.learners l
    where l.school_id=p_school_id and l.status in ('enrolled','active')
    order by l.last_name,l.first_name;
end;
$$;

grant execute on function public.list_transport_learners(uuid) to authenticated;
revoke execute on function public.list_transport_learners(uuid) from public;

create or replace function public.get_transport_roster(p_schedule_id uuid)
returns table(
  learner_id uuid,
  learner_number text,
  first_name text,
  last_name text,
  pickup_stop_id uuid,
  dropoff_stop_id uuid,
  attendance_status public.transport_attendance_status,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare v_school uuid; v_route uuid; v_date date;
begin
  select school_id,route_id,service_date into v_school,v_route,v_date
  from public.transport_schedules where id=p_schedule_id;
  if v_school is null then raise exception 'not_found: transport schedule'; end if;
  if not public.can_manage_transport(v_school) then raise exception 'insufficient_privilege: cannot manage transport'; end if;

  return query
    select a.learner_id,l.learner_number,l.first_name,l.last_name,
           a.pickup_stop_id,a.dropoff_stop_id,ta.status,ta.recorded_at
    from public.transport_assignments a
    join public.learners l on l.id=a.learner_id
    left join public.transport_attendance ta on ta.schedule_id=p_schedule_id and ta.learner_id=a.learner_id
    where a.school_id=v_school
      and a.route_id=v_route
      and a.status='active'
      and a.effective_from <= v_date
      and (a.effective_to is null or a.effective_to >= v_date)
    order by l.last_name,l.first_name;
end;
$$;

grant execute on function public.get_transport_roster(uuid) to authenticated;
revoke execute on function public.get_transport_roster(uuid) from public;

create or replace function public.add_transport_route_stop(
  p_route_id uuid,
  p_stop_id uuid,
  p_stop_order integer,
  p_pickup_time time default null,
  p_dropoff_time time default null
) returns public.transport_route_stops
language plpgsql
security definer
set search_path = public
as $$
declare v_school uuid; v_result public.transport_route_stops;
begin
  select school_id into v_school from public.transport_routes where id=p_route_id;
  if v_school is null then raise exception 'not_found: route'; end if;
  if not public.can_manage_transport(v_school) then raise exception 'insufficient_privilege: cannot manage transport'; end if;
  if not exists (select 1 from public.transport_stops where id=p_stop_id and school_id=v_school and active) then
    raise exception 'validation_error: stop is not active for this school';
  end if;
  insert into public.transport_route_stops(school_id,route_id,stop_id,stop_order,pickup_time,dropoff_time)
  values(v_school,p_route_id,p_stop_id,p_stop_order,p_pickup_time,p_dropoff_time)
  returning * into v_result;
  perform public.write_audit_log(v_school,auth.uid(),'transport_route_stop_added','transport_route_stops',v_result.id,
    null,jsonb_build_object('route_id',p_route_id,'stop_id',p_stop_id,'stop_order',p_stop_order));
  return v_result;
end;
$$;

grant execute on function public.add_transport_route_stop(uuid,uuid,integer,time,time) to authenticated;
revoke execute on function public.add_transport_route_stop(uuid,uuid,integer,time,time) from public;

create or replace function public.create_transport_charge(
  p_learner_id uuid,
  p_fee_structure_id uuid,
  p_due_date date default null,
  p_notes text default null
) returns public.learner_fee_charges
language plpgsql
security definer
set search_path = public
as $$
declare v_school uuid; v_year uuid; v_amount numeric(12,2); v_name text; v_result public.learner_fee_charges;
begin
  select school_id into v_school from public.learners where id=p_learner_id;
  if v_school is null then raise exception 'not_found: learner'; end if;
  if not public.can_manage_learner_financial(v_school) then raise exception 'insufficient_privilege: cannot manage learner financials'; end if;
  if not exists (
    select 1 from public.transport_assignments a
    where a.learner_id=p_learner_id and a.school_id=v_school and a.status='active'
      and a.effective_from <= current_date and (a.effective_to is null or a.effective_to >= current_date)
  ) then
    raise exception 'validation_error: learner has no active transport assignment';
  end if;
  select academic_year_id,amount,name into v_year,v_amount,v_name
  from public.fee_structures
  where id=p_fee_structure_id and school_id=v_school and category='transport' and active;
  if v_year is null then raise exception 'validation_error: active transport fee structure not found'; end if;
  if exists (
    select 1 from public.learner_fee_charges
    where learner_id=p_learner_id and fee_structure_id=p_fee_structure_id and active
      and (p_due_date is null or due_date=p_due_date)
  ) then
    raise exception 'validation_error: matching transport charge already exists';
  end if;

  insert into public.learner_fee_charges(
    school_id,learner_id,academic_year_id,fee_structure_id,description,category,amount,due_date,notes
  )
  values(v_school,p_learner_id,v_year,p_fee_structure_id,v_name,'transport',v_amount,p_due_date,p_notes)
  returning * into v_result;
  return v_result;
end;
$$;

grant execute on function public.create_transport_charge(uuid,uuid,date,text) to authenticated;
revoke execute on function public.create_transport_charge(uuid,uuid,date,text) from public;

-- Production invariants for trip scheduling.
create or replace function public.transport_schedule_validate_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_assigned integer;
  v_driver_status public.transport_driver_status;
  v_licence_expiry date;
begin
  select capacity into v_capacity from public.transport_vehicles where id=new.vehicle_id and school_id=new.school_id;
  if v_capacity is null then raise exception 'validation_error: vehicle is not valid for this school'; end if;

  select count(*) into v_assigned
  from public.transport_assignments a
  where a.school_id=new.school_id and a.route_id=new.route_id and a.status='active'
    and a.effective_from <= new.service_date
    and (a.effective_to is null or a.effective_to >= new.service_date);

  if v_assigned > v_capacity then
    raise exception 'validation_error: route has % active learners but vehicle capacity is %', v_assigned, v_capacity;
  end if;

  if new.driver_id is not null then
    select status,licence_expiry into v_driver_status,v_licence_expiry
    from public.transport_drivers where id=new.driver_id and school_id=new.school_id;
    if v_driver_status is null or v_driver_status <> 'active' then
      raise exception 'validation_error: driver is not active';
    end if;
    if v_licence_expiry is not null and v_licence_expiry < new.service_date then
      raise exception 'validation_error: driver licence expires before the trip date';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists transport_schedules_validate_capacity on public.transport_schedules;
create trigger transport_schedules_validate_capacity
before insert or update on public.transport_schedules
for each row execute function public.transport_schedule_validate_capacity();

create or replace function public.create_transport_schedule(
  p_school_id uuid,
  p_route_id uuid,
  p_vehicle_id uuid,
  p_driver_id uuid default null,
  p_service_date date default current_date,
  p_departure_time time default null,
  p_notes text default null
) returns public.transport_schedules
language plpgsql
security definer
set search_path = public
as $$
declare v_result public.transport_schedules;
begin
  if not public.can_manage_transport(p_school_id) then
    raise exception 'insufficient_privilege: cannot manage transport';
  end if;
  insert into public.transport_schedules(
    school_id,route_id,vehicle_id,driver_id,service_date,departure_time,status,notes
  ) values (
    p_school_id,p_route_id,p_vehicle_id,p_driver_id,p_service_date,p_departure_time,'scheduled',p_notes
  ) returning * into v_result;
  perform public.write_audit_log(p_school_id,auth.uid(),'transport_trip_created','transport_schedules',v_result.id,
    null,jsonb_build_object('route_id',p_route_id,'vehicle_id',p_vehicle_id,'driver_id',p_driver_id,'service_date',p_service_date));
  return v_result;
end;
$$;

grant execute on function public.create_transport_schedule(uuid,uuid,uuid,uuid,date,time,text) to authenticated;
revoke execute on function public.create_transport_schedule(uuid,uuid,uuid,uuid,date,time,text) from public;
