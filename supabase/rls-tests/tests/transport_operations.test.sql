-- Transport operational workflow regression suite.
-- Covers assignment overlap prevention, route-stop validation, roster derivation,
-- trip attendance lifecycle, tenant isolation and guardian visibility.

do $$
declare
  v_route uuid := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  v_stop uuid := 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa';
  v_vehicle uuid := 'aaaaaaaa-3333-3333-3333-aaaaaaaaaaaa';
  v_driver uuid := 'aaaaaaaa-4444-4444-4444-aaaaaaaaaaaa';
  v_assignment public.transport_assignments;
  v_schedule uuid;
  v_learner uuid := '77770000-0000-0000-0000-000000000001';
  v_count int;
  v_error text;
begin
  perform set_config('request.jwt.claims',
    test_util.jwt_claims('22222222-2222-2222-2222-222222222222','school_owner','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';

  insert into public.learners(id,school_id,learner_number,admission_number,first_name,last_name,date_of_birth,admission_date,status)
    values(v_learner,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','LRN-T001','ADM-T001','Transport','Test','2015-01-01',current_date,'enrolled')
    on conflict (id) do nothing;

  insert into public.transport_routes(id,school_id,name,code,direction)
    values(v_route,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Ops Route','OPS-01','both')
    on conflict (id) do nothing;
  insert into public.transport_stops(id,school_id,name)
    values(v_stop,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Ops Stop')
    on conflict (id) do nothing;
  insert into public.transport_vehicles(id,school_id,registration_number,capacity)
    values(v_vehicle,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','OPS-001',20)
    on conflict (id) do nothing;
  insert into public.transport_drivers(id,school_id,first_name,last_name)
    values(v_driver,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Ops','Driver')
    on conflict (id) do nothing;

  perform public.add_transport_route_stop(v_route,v_stop,1);

  select count(*) into v_count from public.transport_route_stops where route_id=v_route and stop_id=v_stop;
  call test_util.record('route stop is created through workflow',v_count=1,'rows: '||v_count);

  v_assignment := public.create_transport_assignment(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    v_learner,
    v_route,v_stop,v_stop,current_date,null,null
  );

  begin
    perform public.create_transport_assignment(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      v_learner,
      v_route,v_stop,v_stop,current_date,null,null
    );
    call test_util.record('overlapping learner assignment is rejected',false,'second assignment succeeded');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('overlapping learner assignment is rejected',position('overlapping' in lower(v_error)) > 0,v_error);
  end;

  insert into public.transport_schedules(school_id,route_id,vehicle_id,driver_id,service_date)
    values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_route,v_vehicle,v_driver,current_date)
    returning id into v_schedule;

  select count(*) into v_count from public.get_transport_roster(v_schedule);
  call test_util.record('trip roster derives active learner assignment',v_count=1,'roster rows: '||v_count);

  perform public.record_transport_attendance(v_schedule,v_learner,'picked_up','test');
  select count(*) into v_count from public.transport_attendance
    where schedule_id=v_schedule and learner_id=v_learner and status='picked_up';
  call test_util.record('pickup attendance is recorded',v_count=1,'rows: '||v_count);

  execute 'reset role';
end;
$$;

do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    test_util.jwt_claims('66666666-6666-6666-6666-666666666666','school_owner','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.transport_routes where id='aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  call test_util.record('transport route is tenant isolated',v_count=0,'visible: '||v_count);
  execute 'reset role';
end;
$$;

do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    test_util.jwt_claims('55555555-5555-5555-5555-555555555555','parent','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.transport_assignments
    where learner_id='11110000-0000-0000-0000-000000000001';
  call test_util.record('guardian sees own transport assignment',v_count>=1,'visible: '||v_count);
  select count(*) into v_count from public.transport_vehicles;
  call test_util.record('guardian cannot see transport fleet',v_count=0,'visible: '||v_count);
  execute 'reset role';
end;
$$;
