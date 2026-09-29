-- Platform completion-wave RLS and workflow regression suite.
do $$
declare v_school uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; v_house uuid; v_book uuid; v_activity uuid; v_asset_cat uuid; v_supplier uuid; v_event uuid; v_req uuid; v_visible int; v_error text;
begin
 perform set_config('request.jwt.claims',test_util.jwt_claims('22222222-2222-2222-2222-222222222222','school_owner',v_school::text),true);
 execute 'set local role authenticated';

 insert into public.boarding_houses(school_id,name,code,capacity) values(v_school,'Test House','TH',10) returning id into v_house;
 insert into public.library_books(school_id,title) values(v_school,'Test Book') returning id into v_book;
 insert into public.sports_activities(school_id,name) values(v_school,'Test Sport') returning id into v_activity;
 insert into public.asset_categories(school_id,name,code) values(v_school,'Test Assets','TA') returning id into v_asset_cat;
 insert into public.procurement_suppliers(school_id,name) values(v_school,'Test Supplier') returning id into v_supplier;
 insert into public.school_events(school_id,title,event_type,starts_at,ends_at) values(v_school,'Test Event','academic',now()+interval '1 day',now()+interval '2 days') returning id into v_event;
 call test_util.record('operations masters are writable to manager',v_house is not null and v_book is not null and v_activity is not null and v_asset_cat is not null and v_supplier is not null and v_event is not null,'master creation failed');

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