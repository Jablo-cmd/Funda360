-- Funda360 next-generation RLS and workflow regression suite.
do $$
declare
  a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  learner_a uuid;
  visible int;
  rid uuid;
  wid uuid;
  v_error text;
begin
  select id into learner_a from public.learners where school_id=a limit 1;
  if learner_a is null then
    call test_util.record('next-gen learner fixture exists',false,'No learner fixture for School A');
    return;
  end if;

  perform set_config('request.jwt.claims',test_util.jwt_claims('22222222-2222-2222-2222-222222222222','school_owner',a),true);
  execute 'set local role authenticated';

  select id into rid from public.funda_risk_profiles where school_id=a and learner_id=learner_a;
  select public.funda_calculate_risk(a,learner_a,75,45,4) ->> 'risk_level' into v_error;
  call test_util.record('next-gen risk engine writes tenant-scoped risk',v_error='critical','unexpected risk level: '||coalesce(v_error,'null'));

  select public.funda_record_gate_scan(a,learner_a,'Main Gate','in','qr') into rid;
  call test_util.record('Funda ID gate workflow records scan',rid is not null,'scan not recorded');

  select public.funda_create_workflow(a,'Test attendance workflow','learner.absent','{"days":3}'::jsonb,'[{"type":"notify_guardian"}]'::jsonb) into wid;
  call test_util.record('Funda Flow workflow creates safely',wid is not null,'workflow not created');

  execute 'reset role';

  perform set_config('request.jwt.claims',test_util.jwt_claims('33333333-3333-3333-3333-333333333333','teacher',b),true);
  execute 'set local role authenticated';

  select count(*) into visible from public.funda_risk_profiles where school_id=a;
  call test_util.record('next-gen risk cross-tenant isolation',visible=0,'visible: '||visible);

  begin
    insert into public.funda_gate_scans(school_id,learner_id,gate,direction,method)
    values(a,learner_a,'Main Gate','in','manual');
    call test_util.record('next-gen gate cross-tenant write denied',false,'insert unexpectedly succeeded');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('next-gen gate cross-tenant write denied',true,v_error);
  end;

  begin
    insert into public.funda_health_records(school_id,learner_id,record_type,summary)
    values(a,learner_a,'test','Denied');
    call test_util.record('next-gen health cross-tenant write denied',false,'insert unexpectedly succeeded');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('next-gen health cross-tenant write denied',true,v_error);
  end;

  execute 'reset role';
end $$;
