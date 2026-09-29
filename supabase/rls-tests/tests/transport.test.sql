-- Transport domain RLS regression suite.
-- Uses the shared RLS harness fixtures: School A aaaa..., School B bbbb...,
-- school owner A 2222..., teacher A 1111..., guardian A 5555...,
-- learner A 11110000..., teacher B 3333....

do $$
declare v_vehicle uuid; v_driver uuid; v_route uuid; v_stop uuid; v_assignment uuid; v_schedule uuid; v_visible int; v_error text;
begin
  perform set_config('request.jwt.claims', test_util.jwt_claims('22222222-2222-2222-2222-222222222222','school_owner','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';

  insert into public.transport_vehicles(school_id,registration_number,capacity) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','FND-001',20) returning id into v_vehicle;
  insert into public.transport_drivers(school_id,first_name,last_name,phone) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Test','Driver','0100000000') returning id into v_driver;
  insert into public.transport_routes(school_id,name,code,direction) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','North Route','NR-01','morning') returning id into v_route;
  insert into public.transport_stops(school_id,name,address) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','North Stop','Test Street') returning id into v_stop;
  insert into public.transport_assignments(school_id,learner_id,route_id,pickup_stop_id,effective_from)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11110000-0000-0000-0000-000000000001',v_route,v_stop,current_date) returning id into v_assignment;
  insert into public.transport_schedules(school_id,route_id,vehicle_id,driver_id,service_date)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_route,v_vehicle,v_driver,current_date) returning id into v_schedule;
  execute 'reset role';

  perform set_config('request.jwt.claims', test_util.jwt_claims('11111111-1111-1111-1111-111111111111','teacher','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  select count(*) into v_visible from public.transport_vehicles where id=v_vehicle;
  call test_util.record('transport teacher can view fleet', v_visible=1, 'visible: '||v_visible);
  begin
    insert into public.transport_vehicles(school_id,registration_number,capacity) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','DENIED-001',10);
    call test_util.record('transport teacher cannot create fleet',false,'insert succeeded unexpectedly');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('transport teacher cannot create fleet',true,'rejected: '||v_error);
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', test_util.jwt_claims('55555555-5555-5555-5555-555555555555','parent','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  select count(*) into v_visible from public.transport_assignments where id=v_assignment;
  call test_util.record('guardian sees own child transport assignment',v_visible=1,'visible: '||v_visible);
  select count(*) into v_visible from public.transport_routes where id=v_route;
  call test_util.record('guardian sees assigned route',v_visible=1,'visible: '||v_visible);
  select count(*) into v_visible from public.transport_vehicles where id=v_vehicle;
  call test_util.record('guardian cannot see fleet internals',v_visible=0,'visible: '||v_visible);
  begin
    perform public.set_transport_trip_status(v_schedule,'completed');
    call test_util.record('guardian cannot change trip status',false,'RPC succeeded unexpectedly');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('guardian cannot change trip status',true,'rejected: '||v_error);
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', test_util.jwt_claims('33333333-3333-3333-3333-333333333333','teacher','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), true);
  execute 'set local role authenticated';
  select count(*) into v_visible from public.transport_vehicles where id=v_vehicle;
  call test_util.record('cross-tenant teacher cannot see School A fleet',v_visible=0,'visible: '||v_visible);
  execute 'reset role';
end $$;
