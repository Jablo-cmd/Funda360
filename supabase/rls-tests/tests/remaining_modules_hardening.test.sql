-- Remaining operational modules: workflow authorization and tenant isolation.
do $$
declare
  v_school uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_other uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_event public.school_events;
  v_meeting public.governance_meetings;
  v_req public.purchase_requests;
  v_workspace jsonb;
  v_error text;
begin
  perform set_config('request.jwt.claims',test_util.jwt_claims('22222222-2222-2222-2222-222222222222','school_owner',v_school),true);
  execute 'set local role authenticated';

  v_event:=public.create_school_event(v_school,'Hardening Event','academic',now()+interval '1 day',now()+interval '2 days');
  call test_util.record('events create workflow succeeds for manager',v_event.school_id=v_school,'event was not created');

  v_meeting:=public.create_governance_meeting(v_school,'SGB Hardening Meeting',current_date);
  call test_util.record('governance meeting workflow succeeds for manager',v_meeting.school_id=v_school,'meeting was not created');

  v_req:=public.create_purchase_request(v_school,'Hardening procurement request',1000);
  call test_util.record('procurement request workflow succeeds',v_req.school_id=v_school and v_req.status='draft','request was not created');

  v_workspace:=public.get_operations_workspace(v_school);
  call test_util.record('operations workspace is tenant-scoped',v_workspace ? 'events' and v_workspace ? 'procurement','workspace missing operational domains');

  begin
    perform public.get_operations_workspace(v_other);
    call test_util.record('workspace blocks cross-tenant access',false,'cross-tenant workspace access unexpectedly succeeded');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('workspace blocks cross-tenant access',position('insufficient_privilege' in v_error)>0,v_error);
  end;

  begin
    perform public.get_advanced_analytics(v_other);
    call test_util.record('analytics blocks cross-tenant access',false,'cross-tenant analytics unexpectedly succeeded');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('analytics blocks cross-tenant access',position('insufficient_privilege' in v_error)>0,v_error);
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims',test_util.jwt_claims('33333333-3333-3333-3333-333333333333','teacher',v_other),true);
  execute 'set local role authenticated';

  begin
    perform public.create_school_event(v_school,'Denied Event','academic',now()+interval '1 day',now()+interval '2 days');
    call test_util.record('teacher cannot create event for another tenant',false,'cross-tenant event create succeeded');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('teacher cannot create event for another tenant',position('insufficient_privilege' in v_error)>0,v_error);
  end;

  begin
    perform public.get_operations_analytics(v_school);
    call test_util.record('teacher cannot read another tenant analytics',false,'cross-tenant analytics read succeeded');
  exception when others then
    get stacked diagnostics v_error=message_text;
    call test_util.record('teacher cannot read another tenant analytics',position('insufficient_privilege' in v_error)>0,v_error);
  end;
  execute 'reset role';
end $$;
