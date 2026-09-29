-- Platform completion-wave RLS and workflow regression suite.
do $$
declare v_school uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; v_house uuid; v_book uuid; v_activity uuid; v_asset_cat uuid; v_supplier uuid; v_event uuid; v_req public.data_subject_requests; v_visible int; v_error text; v_ok boolean;
begin
 perform set_config('request.jwt.claims',test_util.jwt_claims('22222222-2222-2222-2222-222222222222','school_owner',v_school),true);
 execute 'set local role authenticated';

 perform public.create_operation_record('boarding_house',v_school,jsonb_build_object('name','Test House','code','TH','capacity',10));
 select id into v_house from public.boarding_houses where school_id=v_school and code='TH' limit 1;
 perform public.create_operation_record('library_book',v_school,jsonb_build_object('title','Test Book'));
 select id into v_book from public.library_books where school_id=v_school and title='Test Book' limit 1;
 perform public.create_operation_record('sports_activity',v_school,jsonb_build_object('name','Test Sport','category','sport'));
 select id into v_activity from public.sports_activities where school_id=v_school and name='Test Sport' limit 1;
 perform public.create_operation_record('asset_category',v_school,jsonb_build_object('name','Test Assets','code','TA'));
 select id into v_asset_cat from public.asset_categories where school_id=v_school and code='TA' limit 1;
 perform public.create_operation_record('supplier',v_school,jsonb_build_object('name','Test Supplier'));
 select id into v_supplier from public.procurement_suppliers where school_id=v_school and name='Test Supplier' limit 1;
 perform public.create_operation_record('event',v_school,jsonb_build_object('title','Test Event','event_type','academic','starts_at',(now()+interval '1 day')::text,'ends_at',(now()+interval '2 days')::text));
 select id into v_event from public.school_events where school_id=v_school and title='Test Event' limit 1;
 select (count(*) filter(where id=v_house)=1) and (select count(*) from public.library_books where id=v_book)=1 and (select count(*) from public.sports_activities where id=v_activity)=1 and (select count(*) from public.asset_categories where id=v_asset_cat)=1 and (select count(*) from public.procurement_suppliers where id=v_supplier)=1 and (select count(*) from public.school_events where id=v_event)=1 into v_ok from public.boarding_houses where id=v_house;
 call test_util.record('operations masters are writable to manager',coalesce(v_ok,false),'one or more master records missing');

 v_req:=public.create_data_subject_request(v_school,p_request_type=>'access');
 call test_util.record('DSAR request is auditable',v_req is not null,'request not created');
 execute 'reset role';

 perform set_config('request.jwt.claims',test_util.jwt_claims('33333333-3333-3333-3333-333333333333','teacher','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),true);
 execute 'set local role authenticated';
 select count(*) into v_visible from public.boarding_houses where id=v_house;
 call test_util.record('cross-tenant operations isolation',v_visible=0,'visible: '||v_visible);
 begin
   insert into public.library_books(school_id,title) values(v_school,'Denied');
   call test_util.record('cross-tenant write denied',false,'insert unexpectedly succeeded');
 exception when others then
   get stacked diagnostics v_error=message_text;
   call test_util.record('cross-tenant write denied',true,v_error);
 end;
 execute 'reset role';
end $$;