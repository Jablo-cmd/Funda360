-- Funda360 remaining operational domains: workflow completion + security hardening.
-- Additive only. All privileged state transitions are RPC-mediated and audited.

create or replace function public.operations_role_allowed(target_school_id uuid, allowed_roles text[])
returns boolean
language sql stable set search_path=public
as $$
  select public.is_platform_admin()
    or (
      public.current_tenant_id() = target_school_id
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.tenant_id = target_school_id
          and p.status = 'active'
          and p.role::text = any(allowed_roles)
      )
    );
$$;

create or replace function public.can_manage_operations(target_school_id uuid)
returns boolean language sql stable set search_path=public as $$
  select public.operations_role_allowed(target_school_id, array[
    'school_owner','principal','vice_principal','platform_owner','platform_administrator',
    'super_administrator','boarding_manager','librarian','sports_coordinator',
    'asset_manager','procurement_officer','governance_officer','events_coordinator',
    'transport_coordinator'
  ]);
$$;

create or replace function public.can_view_operations(target_school_id uuid)
returns boolean language sql stable set search_path=public as $$
  select public.is_platform_admin()
      or (
        public.current_tenant_id() = target_school_id
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.tenant_id = target_school_id
            and p.status = 'active'
            and p.role::text <> all(array['parent','guardian','learner','guest'])
        )
      );
$$;

-- Stronger tenant validation for every operational FK that points at another
-- tenant-scoped record. This closes the common "same school_id but foreign
-- row from another school" failure mode.
create or replace function public.operations_validate_tenant()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_school uuid;
begin
  if new.school_id is null then
    raise exception 'validation_error: school_id required';
  end if;

  if tg_table_name = 'boarding_rooms' then
    select school_id into target_school from public.boarding_houses where id = new.house_id;
  elsif tg_table_name = 'boarding_beds' then
    select school_id into target_school from public.boarding_rooms where id = new.room_id;
  elsif tg_table_name = 'boarding_allocations' then
    select school_id into target_school from public.boarding_beds where id = new.bed_id;
    if target_school is null or target_school <> new.school_id then raise exception 'validation_error: cross-tenant bed'; end if;
    if not exists(select 1 from public.learners where id=new.learner_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
    return new;
  elsif tg_table_name = 'boarding_attendance' or tg_table_name = 'boarding_leave' then
    if not exists(select 1 from public.learners where id=new.learner_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
    return new;
  elsif tg_table_name = 'library_copies' then
    select school_id into target_school from public.library_books where id = new.book_id;
  elsif tg_table_name = 'library_loans' then
    select school_id into target_school from public.library_copies where id = new.copy_id;
    if target_school is null or target_school <> new.school_id then raise exception 'validation_error: cross-tenant copy'; end if;
    if not exists(select 1 from public.learners where id=new.learner_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
    return new;
  elsif tg_table_name = 'library_reservations' then
    select school_id into target_school from public.library_books where id = new.book_id;
    if not exists(select 1 from public.learners where id=new.learner_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
  elsif tg_table_name = 'sports_teams' then
    select school_id into target_school from public.sports_activities where id = new.activity_id;
  elsif tg_table_name = 'sports_players' then
    select school_id into target_school from public.sports_teams where id = new.team_id;
    if target_school is null or target_school <> new.school_id then raise exception 'validation_error: cross-tenant team'; end if;
    if not exists(select 1 from public.learners where id=new.learner_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
    return new;
  elsif tg_table_name = 'sports_fixtures' then
    select school_id into target_school from public.sports_teams where id = new.team_id;
  elsif tg_table_name = 'sports_attendance' then
    select school_id into target_school from public.sports_fixtures where id = new.fixture_id;
    if target_school is null or target_school <> new.school_id then raise exception 'validation_error: cross-tenant fixture'; end if;
    if not exists(select 1 from public.learners where id=new.learner_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
    return new;
  elsif tg_table_name = 'assets' then
    select school_id into target_school from public.asset_categories where id = new.category_id;
  elsif tg_table_name in ('asset_movements','asset_maintenance') then
    select school_id into target_school from public.assets where id = new.asset_id;
  elsif tg_table_name = 'purchase_request_items' then
    select school_id into target_school from public.purchase_requests where id = new.request_id;
  elsif tg_table_name = 'purchase_orders' then
    select school_id into target_school from public.purchase_requests where id = new.request_id;
    if new.supplier_id is not null and not exists(select 1 from public.procurement_suppliers where id=new.supplier_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant supplier'; end if;
  elsif tg_table_name = 'goods_receipts' then
    select school_id into target_school from public.purchase_orders where id = new.purchase_order_id;
  elsif tg_table_name = 'supplier_invoices' then
    select school_id into target_school from public.purchase_orders where id = new.purchase_order_id;
    if new.supplier_id is not null and not exists(select 1 from public.procurement_suppliers where id=new.supplier_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant supplier'; end if;
  elsif tg_table_name = 'governance_resolutions' then
    select school_id into target_school from public.governance_meetings where id = new.meeting_id;
  elsif tg_table_name = 'event_participants' then
    select school_id into target_school from public.school_events where id = new.event_id;
    if new.learner_id is not null and not exists(select 1 from public.learners where id=new.learner_id and school_id=new.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
    if new.profile_id is not null and not exists(select 1 from public.profiles where id=new.profile_id and tenant_id=new.school_id) then raise exception 'validation_error: cross-tenant profile'; end if;
  end if;

  if target_school is not null and target_school <> new.school_id then
    raise exception 'validation_error: cross-tenant reference';
  end if;
  return new;
end $$;

-- Boarding
create or replace function public.boarding_allocate_learner(p_school_id uuid,p_learner_id uuid,p_bed_id uuid,p_effective_from date default current_date,p_notes text default null)
returns public.boarding_allocations language plpgsql security definer set search_path=public as $$
declare r public.boarding_allocations;
begin
 if not public.operations_role_allowed(p_school_id,array['school_owner','principal','vice_principal','boarding_manager','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if not exists(select 1 from public.learners where id=p_learner_id and school_id=p_school_id and boarding_type='boarder') then raise exception 'validation_error: learner is not an active boarder'; end if;
 if not exists(select 1 from public.boarding_beds b join public.boarding_rooms rm on rm.id=b.room_id where b.id=p_bed_id and b.school_id=p_school_id and b.active and rm.active) then raise exception 'validation_error: bed unavailable'; end if;
 if exists(select 1 from public.boarding_allocations where learner_id=p_learner_id and status='active') then raise exception 'validation_error: learner already allocated'; end if;
 insert into public.boarding_allocations(school_id,learner_id,bed_id,effective_from,notes) values(p_school_id,p_learner_id,p_bed_id,p_effective_from,p_notes) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'boarding_allocated','boarding_allocations',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.boarding_record_attendance(p_school_id uuid,p_learner_id uuid,p_date date,p_status text)
returns public.boarding_attendance language plpgsql security definer set search_path=public as $$
declare r public.boarding_attendance;
begin
 if not public.operations_role_allowed(p_school_id,array['school_owner','principal','vice_principal','boarding_manager','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('present','absent','late','leave') then raise exception 'validation_error'; end if;
 insert into public.boarding_attendance(school_id,learner_id,attendance_date,status,recorded_by) values(p_school_id,p_learner_id,p_date,p_status,auth.uid())
 on conflict(learner_id,attendance_date) do update set status=excluded.status,recorded_by=auth.uid(),recorded_at=now()
 returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'boarding_attendance_recorded','boarding_attendance',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.boarding_transition_leave(p_leave_id uuid,p_status text)
returns public.boarding_leave language plpgsql security definer set search_path=public as $$
declare r public.boarding_leave;
begin
 select * into r from public.boarding_leave where id=p_leave_id;
 if r.id is null or not public.operations_role_allowed(r.school_id,array['school_owner','principal','vice_principal','boarding_manager','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('approved','rejected','returned') then raise exception 'validation_error'; end if;
 update public.boarding_leave set status=p_status,approved_by=case when p_status='approved' then auth.uid() else approved_by end where id=p_leave_id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'boarding_leave_status_changed','boarding_leave',r.id,null,jsonb_build_object('status',p_status));
 return r;
end $$;

-- Library
create or replace function public.library_reserve(p_school_id uuid,p_book_id uuid,p_learner_id uuid)
returns public.library_reservations language plpgsql security definer set search_path=public as $$
declare r public.library_reservations;
begin
 if not public.operations_role_allowed(p_school_id,array['school_owner','principal','vice_principal','librarian','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if not exists(select 1 from public.library_books where id=p_book_id and school_id=p_school_id and active) then raise exception 'validation_error: book unavailable'; end if;
 if not exists(select 1 from public.learners where id=p_learner_id and school_id=p_school_id) then raise exception 'validation_error: learner not in school'; end if;
 insert into public.library_reservations(school_id,book_id,learner_id) values(p_school_id,p_book_id,p_learner_id) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'library_reserved','library_reservations',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.library_renew(p_loan_id uuid,p_due_at timestamptz)
returns public.library_loans language plpgsql security definer set search_path=public as $$
declare r public.library_loans;
begin
 select * into r from public.library_loans where id=p_loan_id;
 if r.id is null or not public.operations_role_allowed(r.school_id,array['school_owner','principal','vice_principal','librarian','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if r.status not in ('borrowed','overdue') or p_due_at <= now() then raise exception 'validation_error: invalid renewal'; end if;
 update public.library_loans set due_at=p_due_at,status='borrowed' where id=p_loan_id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'library_renewed','library_loans',r.id,null,jsonb_build_object('due_at',p_due_at));
 return r;
end $$;

-- Sports
create or replace function public.sports_add_player(p_school_id uuid,p_team_id uuid,p_learner_id uuid)
returns public.sports_players language plpgsql security definer set search_path=public as $$
declare r public.sports_players;
begin
 if not public.operations_role_allowed(p_school_id,array['school_owner','principal','vice_principal','sports_coordinator','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if not exists(select 1 from public.sports_teams where id=p_team_id and school_id=p_school_id and active) then raise exception 'validation_error: team unavailable'; end if;
 if not exists(select 1 from public.learners where id=p_learner_id and school_id=p_school_id) then raise exception 'validation_error: learner not in school'; end if;
 insert into public.sports_players(school_id,team_id,learner_id) values(p_school_id,p_team_id,p_learner_id) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'sports_player_added','sports_players',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.sports_record_fixture_result(p_fixture_id uuid,p_status text,p_score_for integer default null,p_score_against integer default null)
returns public.sports_fixtures language plpgsql security definer set search_path=public as $$
declare r public.sports_fixtures;
begin
 select * into r from public.sports_fixtures where id=p_fixture_id;
 if r.id is null or not public.operations_role_allowed(r.school_id,array['school_owner','principal','vice_principal','sports_coordinator','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('scheduled','played','cancelled') then raise exception 'validation_error'; end if;
 if p_status='played' and (p_score_for is null or p_score_against is null or p_score_for<0 or p_score_against<0) then raise exception 'validation_error: played fixture requires scores'; end if;
 update public.sports_fixtures set status=p_status,score_for=p_score_for,score_against=p_score_against where id=p_fixture_id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'sports_fixture_result_recorded','sports_fixtures',r.id,null,to_jsonb(r));
 return r;
end $$;

-- Assets
create or replace function public.asset_transfer(p_asset_id uuid,p_to_location text,p_to_profile_id uuid default null,p_reason text default null)
returns public.assets language plpgsql security definer set search_path=public as $$
declare a public.assets; m public.asset_movements;
begin
 select * into a from public.assets where id=p_asset_id;
 if a.id is null or not public.operations_role_allowed(a.school_id,array['school_owner','principal','vice_principal','asset_manager','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if p_to_profile_id is not null and not exists(select 1 from public.profiles where id=p_to_profile_id and tenant_id=a.school_id) then raise exception 'validation_error: cross-tenant assignee'; end if;
 insert into public.asset_movements(school_id,asset_id,from_location,to_location,from_profile_id,to_profile_id,moved_by,reason)
 values(a.school_id,a.id,a.location,p_to_location,a.assigned_profile_id,p_to_profile_id,auth.uid(),p_reason) returning * into m;
 update public.assets set location=p_to_location,assigned_profile_id=p_to_profile_id where id=a.id returning * into a;
 perform public.write_audit_log(a.school_id,auth.uid(),'asset_transferred','assets',a.id,to_jsonb(a),to_jsonb(m));
 return a;
end $$;

create or replace function public.asset_set_lifecycle(p_asset_id uuid,p_status text,p_condition text default null)
returns public.assets language plpgsql security definer set search_path=public as $$
declare a public.assets;
begin
 select * into a from public.assets where id=p_asset_id;
 if a.id is null or not public.operations_role_allowed(a.school_id,array['school_owner','principal','vice_principal','asset_manager','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('active','maintenance','disposed','lost') then raise exception 'validation_error'; end if;
 if p_condition is not null and p_condition not in ('new','good','fair','poor','damaged') then raise exception 'validation_error'; end if;
 update public.assets set status=p_status,condition=coalesce(p_condition,condition) where id=a.id returning * into a;
 perform public.write_audit_log(a.school_id,auth.uid(),'asset_lifecycle_changed','assets',a.id,null,to_jsonb(a));
 return a;
end $$;

-- Procurement
create or replace function public.create_purchase_request(p_school_id uuid,p_description text,p_estimated_amount numeric)
returns public.purchase_requests language plpgsql security definer set search_path=public as $$
declare r public.purchase_requests;
begin
 if not public.current_tenant_id()=p_school_id or auth.uid() is null then raise exception 'insufficient_privilege'; end if;
 if p_estimated_amount < 0 then raise exception 'validation_error'; end if;
 insert into public.purchase_requests(school_id,requester_profile_id,description,estimated_amount) values(p_school_id,auth.uid(),p_description,p_estimated_amount) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'purchase_request_created','purchase_requests',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.add_purchase_request_item(p_request_id uuid,p_description text,p_quantity numeric,p_unit_cost numeric)
returns public.purchase_request_items language plpgsql security definer set search_path=public as $$
declare r public.purchase_request_items; req public.purchase_requests;
begin
 select * into req from public.purchase_requests where id=p_request_id;
 if req.id is null or not public.current_tenant_id()=req.school_id then raise exception 'insufficient_privilege'; end if;
 if req.requester_profile_id<>auth.uid() and not public.can_manage_operations(req.school_id) then raise exception 'insufficient_privilege'; end if;
 if p_quantity<=0 or p_unit_cost<0 then raise exception 'validation_error'; end if;
 insert into public.purchase_request_items(school_id,request_id,description,quantity,unit_cost) values(req.school_id,p_request_id,p_description,p_quantity,p_unit_cost) returning * into r;
 return r;
end $$;

create or replace function public.create_purchase_order(p_school_id uuid,p_request_id uuid,p_supplier_id uuid,p_po_number text,p_total_amount numeric)
returns public.purchase_orders language plpgsql security definer set search_path=public as $$
declare r public.purchase_orders;
begin
 if not public.can_manage_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
 if not exists(select 1 from public.purchase_requests where id=p_request_id and school_id=p_school_id and status in ('approved','ordered')) then raise exception 'validation_error: request not approved'; end if;
 if not exists(select 1 from public.procurement_suppliers where id=p_supplier_id and school_id=p_school_id and active) then raise exception 'validation_error: supplier unavailable'; end if;
 insert into public.purchase_orders(school_id,request_id,supplier_id,po_number,total_amount) values(p_school_id,p_request_id,p_supplier_id,p_po_number,p_total_amount) returning * into r;
 update public.purchase_requests set status='ordered' where id=p_request_id;
 perform public.write_audit_log(p_school_id,auth.uid(),'purchase_order_created','purchase_orders',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.record_goods_receipt(p_purchase_order_id uuid,p_notes text default null)
returns public.goods_receipts language plpgsql security definer set search_path=public as $$
declare r public.goods_receipts; po public.purchase_orders;
begin
 select * into po from public.purchase_orders where id=p_purchase_order_id;
 if po.id is null or not public.can_manage_operations(po.school_id) then raise exception 'insufficient_privilege'; end if;
 insert into public.goods_receipts(school_id,purchase_order_id,received_by,notes) values(po.school_id,po.id,auth.uid(),p_notes) returning * into r;
 update public.purchase_orders set status='received' where id=po.id;
 perform public.write_audit_log(po.school_id,auth.uid(),'goods_received','goods_receipts',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.transition_supplier_invoice(p_invoice_id uuid,p_status text)
returns public.supplier_invoices language plpgsql security definer set search_path=public as $$
declare r public.supplier_invoices;
begin
 select * into r from public.supplier_invoices where id=p_invoice_id;
 if r.id is null or not public.can_manage_operations(r.school_id) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('received','approved','paid','disputed') then raise exception 'validation_error'; end if;
 update public.supplier_invoices set status=p_status where id=p_invoice_id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'supplier_invoice_status_changed','supplier_invoices',r.id,null,jsonb_build_object('status',p_status));
 return r;
end $$;

-- Governance and events
create or replace function public.create_governance_meeting(p_school_id uuid,p_title text,p_meeting_date date,p_location text default null)
returns public.governance_meetings language plpgsql security definer set search_path=public as $$
declare r public.governance_meetings;
begin
 if not public.operations_role_allowed(p_school_id,array['school_owner','principal','vice_principal','governance_officer','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 insert into public.governance_meetings(school_id,title,meeting_date,venue) values(p_school_id,p_title,p_meeting_date,p_location) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'governance_meeting_created','governance_meetings',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.create_governance_resolution(p_school_id uuid,p_meeting_id uuid,p_title text,p_decision text,p_due_date date default null)
returns public.governance_resolutions language plpgsql security definer set search_path=public as $$
declare r public.governance_resolutions;
begin
 if not public.operations_role_allowed(p_school_id,array['school_owner','principal','vice_principal','governance_officer','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if not exists(select 1 from public.governance_meetings where id=p_meeting_id and school_id=p_school_id) then raise exception 'validation_error'; end if;
 insert into public.governance_resolutions(school_id,meeting_id,resolution_number,title,decision,due_date)
 values(p_school_id,p_meeting_id,'RES-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'),p_title,p_decision,p_due_date) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'governance_resolution_created','governance_resolutions',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.create_school_event(p_school_id uuid,p_title text,p_event_type text,p_starts_at timestamptz,p_ends_at timestamptz,p_venue text default null,p_description text default null)
returns public.school_events language plpgsql security definer set search_path=public as $$
declare r public.school_events;
begin
 if not public.operations_role_allowed(p_school_id,array['school_owner','principal','vice_principal','events_coordinator','platform_owner','platform_administrator','super_administrator']) then raise exception 'insufficient_privilege'; end if;
 if p_ends_at<=p_starts_at then raise exception 'validation_error: event end must be after start'; end if;
 insert into public.school_events(school_id,title,event_type,starts_at,ends_at,venue,description,created_by) values(p_school_id,p_title,p_event_type,p_starts_at,p_ends_at,p_venue,p_description,auth.uid()) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'school_event_created','school_events',r.id,null,to_jsonb(r));
 return r;
end $$;

create or replace function public.create_event_participant(p_event_id uuid,p_profile_id uuid default null,p_learner_id uuid default null)
returns public.event_participants language plpgsql security definer set search_path=public as $$
declare e public.school_events; r public.event_participants;
begin
 select * into e from public.school_events where id=p_event_id;
 if e.id is null or not public.can_view_operations(e.school_id) then raise exception 'insufficient_privilege'; end if;
 if p_profile_id is null and p_learner_id is null then raise exception 'validation_error: participant required'; end if;
 if p_profile_id is not null and not exists(select 1 from public.profiles where id=p_profile_id and tenant_id=e.school_id) then raise exception 'validation_error: cross-tenant profile'; end if;
 if p_learner_id is not null and not exists(select 1 from public.learners where id=p_learner_id and school_id=e.school_id) then raise exception 'validation_error: cross-tenant learner'; end if;
 insert into public.event_participants(school_id,event_id,profile_id,learner_id) values(e.school_id,e.id,p_profile_id,p_learner_id) returning * into r;
 perform public.write_audit_log(e.school_id,auth.uid(),'event_participant_added','event_participants',r.id,null,to_jsonb(r));
 return r;
end $$;

-- Analytics saved views + controlled export payload
create or replace function public.save_analytics_view(p_school_id uuid,p_name text,p_report_key text,p_filters jsonb default '{}'::jsonb)
returns public.analytics_saved_views language plpgsql security definer set search_path=public as $$
declare r public.analytics_saved_views;
begin
 if not public.can_manage_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
 insert into public.analytics_saved_views(school_id,name,report_key,filters,created_by) values(p_school_id,p_name,p_report_key,p_filters,auth.uid()) returning * into r;
 return r;
end $$;

create or replace function public.get_advanced_analytics(p_school_id uuid)
returns jsonb language sql security definer stable set search_path=public as $$
select jsonb_build_object(
 'attendance',jsonb_build_object(
   'present',(select count(*) from public.attendance_records where school_id=p_school_id and status='present'),
   'absent',(select count(*) from public.attendance_records where school_id=p_school_id and status='absent'),
   'late',(select count(*) from public.attendance_records where school_id=p_school_id and status='late')),
 'finance',jsonb_build_object(
   'charges',(select coalesce(sum(amount),0) from public.learner_fee_charges where school_id=p_school_id and active),
   'payments',(select coalesce(sum(amount),0) from public.learner_fee_payments where school_id=p_school_id),
   'outstanding',(select greatest(0,(select coalesce(sum(amount),0) from public.learner_fee_charges where school_id=p_school_id and active)-(select coalesce(sum(amount),0) from public.learner_fee_payments where school_id=p_school_id))),
 'admissions',jsonb_build_object(
   'submitted',(select count(*) from public.admission_applications where school_id=p_school_id and status='submitted'),
   'accepted',(select count(*) from public.admission_applications where school_id=p_school_id and status='accepted'),
   'enrolled',(select count(*) from public.admission_applications where school_id=p_school_id and status='enrolled')),
 'discipline',jsonb_build_object(
   'total',(select count(*) from public.behaviour_incidents where school_id=p_school_id and active),
   'high',(select count(*) from public.behaviour_incidents where school_id=p_school_id and active and severity='high')),
 'transport',jsonb_build_object(
   'trips',(select count(*) from public.transport_schedules where school_id=p_school_id),
   'no_show',(select count(*) from public.transport_attendance where school_id=p_school_id and status='no_show')),
 'operations',public.get_operations_analytics(p_school_id)
);
$$;

-- Automation control: job configuration is manager-only; execution remains
-- explicit until provider secrets and deployment are available.
create or replace function public.set_automation_job(p_school_id uuid,p_job_key text,p_cron_expression text,p_enabled boolean)
returns public.automation_jobs language plpgsql security definer set search_path=public as $$
declare r public.automation_jobs;
begin
 if not public.can_manage_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
 insert into public.automation_jobs(school_id,job_key,cron_expression,enabled) values(p_school_id,p_job_key,p_cron_expression,p_enabled)
 on conflict(school_id,job_key) do update set cron_expression=excluded.cron_expression,enabled=excluded.enabled
 returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'automation_job_configured','automation_jobs',r.id,null,to_jsonb(r));
 return r;
end $$;

-- POPIA processing is deliberately role-restricted and audited.
create or replace function public.transition_data_subject_request(p_request_id uuid,p_status text,p_outcome text default null)
returns public.data_subject_requests language plpgsql security definer set search_path=public as $$
declare r public.data_subject_requests;
begin
 select * into r from public.data_subject_requests where id=p_request_id;
 if r.id is null or not public.can_view_dsar(r.school_id) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('received','identity_verified','processing','completed','rejected') then raise exception 'validation_error'; end if;
 update public.data_subject_requests set status=p_status,outcome_notes=p_outcome,handled_by=auth.uid(),completed_at=case when p_status='completed' then now() else null end where id=p_request_id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'dsar_status_changed','data_subject_requests',r.id,null,jsonb_build_object('status',p_status));
 return r;
end $$;

-- Sensitive module SELECT policies: least privilege by role.
drop policy if exists boarding_houses_select on public.boarding_houses;
create policy boarding_houses_select on public.boarding_houses for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','boarding_manager','platform_owner','platform_administrator','super_administrator','boarding_manager']));
drop policy if exists boarding_rooms_select on public.boarding_rooms;
create policy boarding_rooms_select on public.boarding_rooms for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','boarding_manager','platform_owner','platform_administrator','super_administrator']));
drop policy if exists boarding_beds_select on public.boarding_beds;
create policy boarding_beds_select on public.boarding_beds for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','boarding_manager','platform_owner','platform_administrator','super_administrator']));
drop policy if exists library_loans_select on public.library_loans;
create policy library_loans_select on public.library_loans for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','librarian','platform_owner','platform_administrator','super_administrator']));
drop policy if exists library_reservations_select on public.library_reservations;
create policy library_reservations_select on public.library_reservations for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','librarian','platform_owner','platform_administrator','super_administrator']));
drop policy if exists sports_players_select on public.sports_players;
create policy sports_players_select on public.sports_players for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','sports_coordinator','platform_owner','platform_administrator','super_administrator']));
drop policy if exists sports_fixtures_select on public.sports_fixtures;
create policy sports_fixtures_select on public.sports_fixtures for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','sports_coordinator','platform_owner','platform_administrator','super_administrator']));
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','asset_manager','platform_owner','platform_administrator','super_administrator']));
drop policy if exists asset_maintenance_select on public.asset_maintenance;
create policy asset_maintenance_select on public.asset_maintenance for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','asset_manager','platform_owner','platform_administrator','super_administrator']));
drop policy if exists purchase_requests_select on public.purchase_requests;
create policy purchase_requests_select on public.purchase_requests for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','procurement_officer','platform_owner','platform_administrator','super_administrator']) or requester_profile_id=auth.uid());
drop policy if exists purchase_request_items_select on public.purchase_request_items;
create policy purchase_request_items_select on public.purchase_request_items for select to authenticated using(public.can_view_operations(school_id));
drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','procurement_officer','platform_owner','platform_administrator','super_administrator']));
drop policy if exists supplier_invoices_select on public.supplier_invoices;
create policy supplier_invoices_select on public.supplier_invoices for select to authenticated using(public.operations_role_allowed(school_id,array['school_owner','principal','vice_principal','procurement_officer','finance_manager','accountant','platform_owner','platform_administrator','super_administrator']));
drop policy if exists governance_documents_select on public.governance_documents;
create policy governance_documents_select on public.governance_documents for select to authenticated using(public.can_view_governance(school_id));
drop policy if exists school_events_select on public.school_events;
create policy school_events_select on public.school_events for select to authenticated using(public.can_view_operations(school_id));
drop policy if exists event_participants_select on public.event_participants;
create policy event_participants_select on public.event_participants for select to authenticated using(public.can_view_operations(school_id));
drop policy if exists interop_imports_select on public.interop_imports;
create policy interop_imports_select on public.interop_imports for select to authenticated using(public.can_manage_operations(school_id));
drop policy if exists analytics_saved_views_select on public.analytics_saved_views;
create policy analytics_saved_views_select on public.analytics_saved_views for select to authenticated using(created_by=auth.uid() or public.can_manage_operations(school_id));

-- Secure all newly-added security-definer functions from anonymous execution.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure::text as sig
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname in (
       'operations_role_allowed','can_manage_operations','can_view_operations','operations_validate_tenant',
       'boarding_allocate_learner','boarding_record_attendance','boarding_transition_leave',
       'library_reserve','library_renew','sports_add_player','sports_record_fixture_result',
       'asset_transfer','asset_set_lifecycle','create_purchase_request','add_purchase_request_item',
       'create_purchase_order','record_goods_receipt','transition_supplier_invoice',
       'create_governance_meeting','create_governance_resolution','create_school_event',
       'create_event_participant','save_analytics_view','get_advanced_analytics','set_automation_job',
       'transition_data_subject_request'
 ) loop
   execute 'revoke execute on function '||f.sig||' from public';
 end loop;
end $$;

create index if not exists library_reservations_book_status_idx on public.library_reservations(school_id,book_id,status);
create index if not exists sports_players_team_active_idx on public.sports_players(school_id,team_id,active);
create index if not exists asset_movements_asset_date_idx on public.asset_movements(school_id,asset_id,moved_at desc);
create index if not exists supplier_invoices_school_status_idx on public.supplier_invoices(school_id,status,received_at);
create index if not exists event_participants_event_idx on public.event_participants(school_id,event_id);


-- SECURITY DEFINER analytics/workspace RPCs must enforce tenant authorization
-- inside the function; RLS does not protect the function body.
create or replace function public.get_operations_analytics(p_school_id uuid)
returns jsonb language plpgsql security definer stable set search_path=public as $$
begin
  if not public.can_view_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'boarding',jsonb_build_object('houses',(select count(*) from public.boarding_houses where school_id=p_school_id and active),'boarders',(select count(*) from public.boarding_allocations where school_id=p_school_id and status='active')),
    'library',jsonb_build_object('books',(select count(*) from public.library_books where school_id=p_school_id and active),'loans',(select count(*) from public.library_loans where school_id=p_school_id and status in ('borrowed','overdue')),'overdue',(select count(*) from public.library_loans where school_id=p_school_id and due_at<now() and returned_at is null)),
    'sports',jsonb_build_object('activities',(select count(*) from public.sports_activities where school_id=p_school_id and active),'teams',(select count(*) from public.sports_teams where school_id=p_school_id and active),'players',(select count(*) from public.sports_players where school_id=p_school_id and active)),
    'assets',jsonb_build_object('assets',(select count(*) from public.assets where school_id=p_school_id and status='active'),'maintenance',(select count(*) from public.asset_maintenance where school_id=p_school_id and status='open'),'warranty_expiring',(select count(*) from public.assets where school_id=p_school_id and warranty_until between current_date and current_date+30)),
    'procurement',jsonb_build_object('requests',(select count(*) from public.purchase_requests where school_id=p_school_id and status in ('submitted','approved','ordered')),'open_invoices',(select count(*) from public.supplier_invoices where school_id=p_school_id and status in ('received','approved'))),
    'governance',jsonb_build_object('meetings',(select count(*) from public.governance_meetings where school_id=p_school_id),'open_resolutions',(select count(*) from public.governance_resolutions where school_id=p_school_id and status<>'complete')),
    'events',jsonb_build_object('upcoming',(select count(*) from public.school_events where school_id=p_school_id and status='scheduled' and starts_at>=now())),
    'compliance',jsonb_build_object('open_dsar',(select count(*) from public.data_subject_requests where school_id=p_school_id and status not in ('completed','rejected')))
  );
end $$;

create or replace function public.get_advanced_analytics(p_school_id uuid)
returns jsonb language plpgsql security definer stable set search_path=public as $$
begin
  if not public.can_view_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'attendance',jsonb_build_object(
      'present',(select count(*) from public.attendance_records where school_id=p_school_id and status='present'),
      'absent',(select count(*) from public.attendance_records where school_id=p_school_id and status='absent'),
      'late',(select count(*) from public.attendance_records where school_id=p_school_id and status='late')),
    'finance',jsonb_build_object(
      'charges',(select coalesce(sum(amount),0) from public.learner_fee_charges where school_id=p_school_id and active),
      'payments',(select coalesce(sum(amount),0) from public.learner_fee_payments where school_id=p_school_id),
      'outstanding',greatest(0,(select coalesce(sum(amount),0) from public.learner_fee_charges where school_id=p_school_id and active)-(select coalesce(sum(amount),0) from public.learner_fee_payments where school_id=p_school_id))),
    'admissions',jsonb_build_object(
      'submitted',(select count(*) from public.admission_applications where school_id=p_school_id and status='submitted'),
      'accepted',(select count(*) from public.admission_applications where school_id=p_school_id and status='accepted'),
      'enrolled',(select count(*) from public.admission_applications where school_id=p_school_id and status='enrolled')),
    'discipline',jsonb_build_object(
      'total',(select count(*) from public.behaviour_incidents where school_id=p_school_id and active),
      'high',(select count(*) from public.behaviour_incidents where school_id=p_school_id and active and severity='high')),
    'transport',jsonb_build_object(
      'trips',(select count(*) from public.transport_schedules where school_id=p_school_id),
      'no_show',(select count(*) from public.transport_attendance where school_id=p_school_id and status='no_show')),
    'operations',public.get_operations_analytics(p_school_id)
  );
end $$;

create or replace function public.get_operations_workspace(p_school_id uuid)
returns jsonb language plpgsql security definer stable set search_path=public as $$
begin
  if not public.can_view_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'boarding',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.id,l.first_name||' '||l.last_name learner,b.code bed_code,h.name house,a.effective_from from public.boarding_allocations a join public.learners l on l.id=a.learner_id join public.boarding_beds b on b.id=a.bed_id join public.boarding_rooms rm on rm.id=b.room_id join public.boarding_houses h on h.id=rm.house_id where a.school_id=p_school_id and a.status='active' order by l.last_name limit 50)x),'[]'::jsonb),
    'library',coalesce((select jsonb_agg(to_jsonb(x)) from (select l.id,b.title,le.first_name||' '||le.last_name learner,l.due_at,l.status from public.library_loans l join public.library_copies c on c.id=l.copy_id join public.library_books b on b.id=c.book_id join public.learners le on le.id=l.learner_id where l.school_id=p_school_id and l.returned_at is null order by l.due_at limit 50)x),'[]'::jsonb),
    'sports',coalesce((select jsonb_agg(to_jsonb(x)) from (select f.id,t.name team,f.fixture_date,f.opponent,f.venue,f.status,f.score_for,f.score_against from public.sports_fixtures f join public.sports_teams t on t.id=f.team_id where f.school_id=p_school_id order by f.fixture_date desc limit 50)x),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.id,a.asset_number,a.description,a.location,a.condition,a.status,a.warranty_until from public.assets a where a.school_id=p_school_id order by a.asset_number limit 100)x),'[]'::jsonb),
    'procurement',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.id,r.description,r.estimated_amount,r.status,r.created_at from public.purchase_requests r where r.school_id=p_school_id order by r.created_at desc limit 50)x),'[]'::jsonb),
    'governance',coalesce((select jsonb_agg(to_jsonb(x)) from (select m.id,m.title,m.meeting_date,m.location from public.governance_meetings m where m.school_id=p_school_id order by m.meeting_date desc limit 50)x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(x)) from (select e.id,e.title,e.event_type,e.starts_at,e.ends_at,e.venue,e.status from public.school_events e where e.school_id=p_school_id and e.starts_at>=now() order by e.starts_at limit 50)x),'[]'::jsonb),
    'interop',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.id,i.entity_type,i.file_name,i.status,i.total_rows,i.valid_rows,i.error_rows,i.created_at from public.interop_imports i where i.school_id=p_school_id order by i.created_at desc limit 50)x),'[]'::jsonb),
    'dsar',coalesce((select jsonb_agg(to_jsonb(x)) from (select d.id,d.request_type,d.status,d.requested_at,d.subject_profile_id,d.subject_learner_id from public.data_subject_requests d where d.school_id=p_school_id order by d.requested_at desc limit 50)x),'[]'::jsonb),
    'automation',coalesce((select jsonb_agg(to_jsonb(x)) from (select j.id,j.job_key,j.cron_expression,j.enabled,j.last_run_at,j.last_result from public.automation_jobs j where j.school_id=p_school_id order by j.job_key)x),'[]'::jsonb)
  );
end $$;

revoke execute on function public.get_operations_analytics(uuid) from public;
revoke execute on function public.get_advanced_analytics(uuid) from public;
revoke execute on function public.get_operations_workspace(uuid) from public;


create or replace function public.get_operations_workspace(p_school_id uuid)
returns jsonb language plpgsql security definer stable set search_path=public as $$
begin
  if not public.can_view_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'learners',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,learner_number,first_name,last_name from public.learners where school_id=p_school_id and status in ('enrolled','active') order by last_name,first_name limit 200)x),'[]'::jsonb),
    'boarding_beds',coalesce((select jsonb_agg(to_jsonb(x)) from (select b.id,b.bed_code,rm.name room,h.name house from public.boarding_beds b join public.boarding_rooms rm on rm.id=b.room_id join public.boarding_houses h on h.id=rm.house_id where b.school_id=p_school_id and b.active order by h.name,rm.name,b.bed_code limit 200)x),'[]'::jsonb),
    'boarding',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.id,l.first_name||' '||l.last_name learner,b.code bed_code,h.name house,a.effective_from from public.boarding_allocations a join public.learners l on l.id=a.learner_id join public.boarding_beds b on b.id=a.bed_id join public.boarding_rooms rm on rm.id=b.room_id join public.boarding_houses h on h.id=rm.house_id where a.school_id=p_school_id and a.status='active' order by l.last_name limit 50)x),'[]'::jsonb),
    'library_copies',coalesce((select jsonb_agg(to_jsonb(x)) from (select c.id,c.barcode,c.status,b.title from public.library_copies c join public.library_books b on b.id=c.book_id where c.school_id=p_school_id order by b.title,c.barcode limit 200)x),'[]'::jsonb),
    'library',coalesce((select jsonb_agg(to_jsonb(x)) from (select l.id,b.title,le.first_name||' '||le.last_name learner,l.due_at,l.status from public.library_loans l join public.library_copies c on c.id=l.copy_id join public.library_books b on b.id=c.book_id join public.learners le on le.id=l.learner_id where l.school_id=p_school_id and l.returned_at is null order by l.due_at limit 50)x),'[]'::jsonb),
    'sports_teams',coalesce((select jsonb_agg(to_jsonb(x)) from (select t.id,t.name team,a.name activity from public.sports_teams t join public.sports_activities a on a.id=t.activity_id where t.school_id=p_school_id and t.active order by a.name,t.name limit 100)x),'[]'::jsonb),
    'sports',coalesce((select jsonb_agg(to_jsonb(x)) from (select f.id,t.name team,f.fixture_date,f.opponent,f.venue,f.status,f.score_for,f.score_against from public.sports_fixtures f join public.sports_teams t on t.id=f.team_id where f.school_id=p_school_id order by f.fixture_date desc limit 50)x),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.id,a.asset_number,a.description,a.location,a.condition,a.status,a.warranty_until from public.assets a where a.school_id=p_school_id order by a.asset_number limit 100)x),'[]'::jsonb),
    'procurement',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.id,r.description,r.estimated_amount,r.status,r.created_at from public.purchase_requests r where r.school_id=p_school_id order by r.created_at desc limit 50)x),'[]'::jsonb),
    'suppliers',coalesce((select jsonb_agg(to_jsonb(x)) from (select s.id,s.name,s.active from public.procurement_suppliers s where s.school_id=p_school_id and s.active order by s.name limit 100)x),'[]'::jsonb),
    'governance_meetings',coalesce((select jsonb_agg(to_jsonb(x)) from (select m.id,m.title,m.meeting_date,m.venue,m.status from public.governance_meetings m where m.school_id=p_school_id order by m.meeting_date desc limit 50)x),'[]'::jsonb),
    'governance',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.id,r.resolution_number,r.title,r.decision,r.status,r.due_date from public.governance_resolutions r where r.school_id=p_school_id order by r.due_date nulls last limit 50)x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(x)) from (select e.id,e.title,e.event_type,e.starts_at,e.ends_at,e.venue,e.status from public.school_events e where e.school_id=p_school_id and e.starts_at>=now() order by e.starts_at limit 50)x),'[]'::jsonb),
    'interop',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.id,i.entity_type,i.file_name,i.status,i.total_rows,i.valid_rows,i.error_rows,i.created_at from public.interop_imports i where i.school_id=p_school_id order by i.created_at desc limit 50)x),'[]'::jsonb),
    'dsar',coalesce((select jsonb_agg(to_jsonb(x)) from (select d.id,d.request_type,d.status,d.requested_at,d.subject_profile_id,d.subject_learner_id from public.data_subject_requests d where d.school_id=p_school_id order by d.requested_at desc limit 50)x),'[]'::jsonb),
    'automation',coalesce((select jsonb_agg(to_jsonb(x)) from (select j.id,j.job_key,j.cron_expression,j.enabled,j.last_run_at,j.last_result from public.automation_jobs j where j.school_id=p_school_id order by j.job_key)x),'[]'::jsonb)
  );
end $$;
revoke execute on function public.get_operations_workspace(uuid) from public;
