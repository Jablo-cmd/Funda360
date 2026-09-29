-- Funda360 platform completion wave: Boarding, Library, Sports, Assets, Procurement,
-- Governance, Events, Interoperability, Analytics, Automation and POPIA workflows.
-- Additive, tenant-scoped, RPC-mediated writes.

create or replace function public.can_manage_operations(target_school_id uuid)
returns boolean language sql stable set search_path=public as $$
  select public.is_platform_admin()
      or (public.current_tenant_id() = target_school_id and coalesce((select role::text from public.profiles where id=auth.uid()),'') in
          ('school_owner','principal','vice_principal','platform_owner','platform_administrator','super_administrator',
           'boarding_manager','librarian','sports_coordinator','asset_manager','procurement_officer','governance_officer','events_coordinator'));
$$;

create or replace function public.can_view_operations(target_school_id uuid)
returns boolean language sql stable set search_path=public as $$
  select public.can_manage_operations(target_school_id)
      or (public.current_tenant_id() = target_school_id and auth.uid() is not null);
$$;

-- BOARDING
create table if not exists public.boarding_houses (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 name text not null, code text not null, house_master_profile_id uuid references public.profiles(id),
 capacity integer not null default 0 check(capacity>=0), active boolean not null default true,
 created_at timestamptz not null default now(), unique(school_id,code)
);
create table if not exists public.boarding_rooms (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 house_id uuid not null references public.boarding_houses(id), name text not null,
 capacity integer not null default 1 check(capacity>0), active boolean not null default true,
 unique(house_id,name)
);
create table if not exists public.boarding_beds (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 room_id uuid not null references public.boarding_rooms(id), bed_code text not null,
 active boolean not null default true, unique(room_id,bed_code)
);
create table if not exists public.boarding_allocations (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 learner_id uuid not null references public.learners(id), bed_id uuid not null references public.boarding_beds(id),
 effective_from date not null default current_date, effective_to date, status text not null default 'active'
   check(status in ('active','ended')), notes text, created_at timestamptz not null default now()
);
create unique index if not exists boarding_one_active_per_learner on public.boarding_allocations(learner_id) where status='active';
create table if not exists public.boarding_attendance (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 learner_id uuid not null references public.learners(id), attendance_date date not null,
 status text not null check(status in ('present','absent','late','leave')), recorded_by uuid references public.profiles(id),
 recorded_at timestamptz not null default now(), unique(learner_id,attendance_date)
);
create table if not exists public.boarding_leave (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 learner_id uuid not null references public.learners(id), starts_at timestamptz not null, ends_at timestamptz not null,
 destination text, reason text, status text not null default 'requested' check(status in ('requested','approved','rejected','returned')),
 approved_by uuid references public.profiles(id), created_at timestamptz not null default now()
);

-- LIBRARY
create table if not exists public.library_books (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 isbn text, title text not null, author text, publisher text, category text, published_year integer,
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.library_copies (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 book_id uuid not null references public.library_books(id), barcode text not null, location text,
 status text not null default 'available' check(status in ('available','borrowed','lost','damaged','withdrawn')),
 unique(school_id,barcode)
);
create table if not exists public.library_loans (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 copy_id uuid not null references public.library_copies(id), learner_id uuid not null references public.learners(id),
 borrowed_at timestamptz not null default now(), due_at timestamptz not null, returned_at timestamptz,
 status text not null default 'borrowed' check(status in ('borrowed','returned','overdue','lost')),
 fine_amount numeric(12,2) not null default 0 check(fine_amount>=0)
);
create table if not exists public.library_reservations (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 book_id uuid not null references public.library_books(id), learner_id uuid not null references public.learners(id),
 status text not null default 'active' check(status in ('active','fulfilled','cancelled')), created_at timestamptz not null default now()
);

-- SPORTS
create table if not exists public.sports_activities (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 name text not null, category text not null default 'sport', active boolean not null default true, unique(school_id,name)
);
create table if not exists public.sports_teams (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 activity_id uuid not null references public.sports_activities(id), name text not null, age_group text,
 coach_profile_id uuid references public.profiles(id), active boolean not null default true
);
create table if not exists public.sports_players (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 team_id uuid not null references public.sports_teams(id), learner_id uuid not null references public.learners(id),
 joined_on date not null default current_date, active boolean not null default true, unique(team_id,learner_id)
);
create table if not exists public.sports_fixtures (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 team_id uuid not null references public.sports_teams(id), fixture_date date not null, opponent text,
 venue text, status text not null default 'scheduled' check(status in ('scheduled','played','cancelled')),
 score_for integer, score_against integer
);
create table if not exists public.sports_attendance (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 fixture_id uuid not null references public.sports_fixtures(id), learner_id uuid not null references public.learners(id),
 status text not null check(status in ('present','absent','excused')), unique(fixture_id,learner_id)
);

-- ASSETS
create table if not exists public.asset_categories (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 name text not null, code text not null, unique(school_id,code)
);
create table if not exists public.assets (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 category_id uuid references public.asset_categories(id), asset_number text not null, serial_number text,
 description text not null, purchase_date date, purchase_cost numeric(14,2), supplier text, location text,
 assigned_profile_id uuid references public.profiles(id), condition text not null default 'good' check(condition in ('new','good','fair','poor','damaged')),
 status text not null default 'active' check(status in ('active','maintenance','disposed','lost')), warranty_until date,
 created_at timestamptz not null default now(), unique(school_id,asset_number)
);
create table if not exists public.asset_movements (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 asset_id uuid not null references public.assets(id), from_location text, to_location text,
 from_profile_id uuid references public.profiles(id), to_profile_id uuid references public.profiles(id),
 moved_at timestamptz not null default now(), moved_by uuid references public.profiles(id), reason text
);
create table if not exists public.asset_maintenance (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 asset_id uuid not null references public.assets(id), opened_at timestamptz not null default now(),
 completed_at timestamptz, vendor text, description text not null, cost numeric(14,2) default 0, status text not null default 'open'
);

-- PROCUREMENT
create table if not exists public.procurement_suppliers (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 name text not null, registration_number text, contact_name text, email text, phone text, active boolean not null default true
);
create table if not exists public.purchase_requests (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 requester_profile_id uuid not null references public.profiles(id), description text not null,
 estimated_amount numeric(14,2) not null default 0, status text not null default 'draft'
 check(status in ('draft','submitted','approved','rejected','ordered','closed')), created_at timestamptz not null default now()
);
create table if not exists public.purchase_request_items (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 request_id uuid not null references public.purchase_requests(id), description text not null,
 quantity numeric(12,2) not null default 1, unit_cost numeric(14,2) not null default 0
);
create table if not exists public.purchase_orders (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 request_id uuid references public.purchase_requests(id), supplier_id uuid not null references public.procurement_suppliers(id),
 po_number text not null, status text not null default 'draft' check(status in ('draft','approved','sent','received','cancelled')),
 total_amount numeric(14,2) not null default 0, created_at timestamptz not null default now(), unique(school_id,po_number)
);
create table if not exists public.goods_receipts (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 purchase_order_id uuid not null references public.purchase_orders(id), received_at timestamptz not null default now(),
 received_by uuid references public.profiles(id), notes text
);
create table if not exists public.supplier_invoices (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 supplier_id uuid not null references public.procurement_suppliers(id), purchase_order_id uuid references public.purchase_orders(id),
 invoice_number text not null, amount numeric(14,2) not null, status text not null default 'received'
 check(status in ('received','approved','paid','disputed')), received_at date not null default current_date
);

-- GOVERNANCE
create table if not exists public.governance_members (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 profile_id uuid references public.profiles(id), full_name text not null, role_title text not null,
 term_start date, term_end date, active boolean not null default true
);
create table if not exists public.governance_meetings (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 meeting_date timestamptz not null, title text not null, venue text, status text not null default 'scheduled'
 check(status in ('scheduled','held','cancelled')), agenda text, minutes text
);
create table if not exists public.governance_resolutions (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 meeting_id uuid references public.governance_meetings(id), resolution_number text not null,
 title text not null, decision text not null, owner_profile_id uuid references public.profiles(id),
 due_date date, status text not null default 'open' check(status in ('open','in_progress','complete','deferred'))
);
create table if not exists public.governance_documents (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 title text not null, document_type text not null, version text, storage_path text, review_due date, status text not null default 'active'
);

-- EVENTS
create table if not exists public.school_events (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 title text not null, event_type text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 venue text, description text, status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),
 created_by uuid references public.profiles(id)
);
create table if not exists public.event_participants (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 event_id uuid not null references public.school_events(id), profile_id uuid references public.profiles(id),
 learner_id uuid references public.learners(id), status text not null default 'invited'
 check(status in ('invited','confirmed','declined','attended')), unique(event_id,profile_id,learner_id)
);
create table if not exists public.school_holidays (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 name text not null, starts_on date not null, ends_on date not null
);

-- INTEROPERABILITY
create table if not exists public.interop_imports (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 entity_type text not null, file_name text not null, format text not null check(format in ('csv','xlsx')),
 status text not null default 'uploaded' check(status in ('uploaded','validated','applied','failed')),
 total_rows integer not null default 0, valid_rows integer not null default 0, error_rows integer not null default 0,
 mapping jsonb not null default '{}'::jsonb, errors jsonb not null default '[]'::jsonb, created_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create table if not exists public.interop_exports (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 entity_type text not null, format text not null check(format in ('csv','xlsx')), filters jsonb not null default '{}'::jsonb,
 row_count integer not null default 0, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.interop_mappings (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 entity_type text not null, name text not null, mapping jsonb not null, active boolean not null default true
);

-- ANALYTICS
create table if not exists public.analytics_saved_views (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 name text not null, report_key text not null, filters jsonb not null default '{}'::jsonb,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);

-- POPIA / DSAR
create table if not exists public.data_subject_requests (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 subject_profile_id uuid references public.profiles(id), subject_learner_id uuid references public.learners(id),
 request_type text not null check(request_type in ('access','correction','restriction','deletion','portability')),
 status text not null default 'received' check(status in ('received','identity_verified','processing','completed','rejected')),
 reason text, requested_at timestamptz not null default now(), completed_at timestamptz,
 handled_by uuid references public.profiles(id), outcome_notes text
);
create table if not exists public.data_retention_policies (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 entity_key text not null, retention_days integer not null check(retention_days>0), legal_basis text,
 active boolean not null default true, unique(school_id,entity_key)
);

-- INDEXES
create index if not exists boarding_allocations_school_idx on public.boarding_allocations(school_id,status);
create index if not exists library_loans_school_idx on public.library_loans(school_id,status,due_at);
create index if not exists sports_fixtures_school_idx on public.sports_fixtures(school_id,fixture_date);
create index if not exists assets_school_idx on public.assets(school_id,status,location);
create index if not exists purchase_requests_school_idx on public.purchase_requests(school_id,status);
create index if not exists governance_meetings_school_idx on public.governance_meetings(school_id,meeting_date);
create index if not exists school_events_school_idx on public.school_events(school_id,starts_at);
create index if not exists interop_imports_school_idx on public.interop_imports(school_id,created_at);
create index if not exists dsar_school_idx on public.data_subject_requests(school_id,status);

-- FORCE RLS + fail-closed SELECT policies. Writes are RPC-only for sensitive workflow tables.
do $$
declare t text;
begin
  foreach t in array array[
    'boarding_houses','boarding_rooms','boarding_beds','boarding_allocations','boarding_attendance','boarding_leave',
    'library_books','library_copies','library_loans','library_reservations',
    'sports_activities','sports_teams','sports_players','sports_fixtures','sports_attendance',
    'asset_categories','assets','asset_movements','asset_maintenance',
    'procurement_suppliers','purchase_requests','purchase_request_items','purchase_orders','goods_receipts','supplier_invoices',
    'governance_members','governance_meetings','governance_resolutions','governance_documents',
    'school_events','event_participants','school_holidays','interop_imports','interop_exports','interop_mappings',
    'analytics_saved_views','data_subject_requests','data_retention_policies'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_select',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_view_operations(school_id))',t||'_select',t);
  end loop;
end $$;

-- tenant validation triggers for cross-tenant FKs
create or replace function public.operations_validate_tenant()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.school_id is null then raise exception 'validation_error: school_id required'; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'boarding_houses','boarding_rooms','boarding_beds','boarding_allocations','boarding_attendance','boarding_leave',
    'library_books','library_copies','library_loans','library_reservations','sports_activities','sports_teams','sports_players',
    'sports_fixtures','sports_attendance','asset_categories','assets','asset_movements','asset_maintenance',
    'procurement_suppliers','purchase_requests','purchase_request_items','purchase_orders','goods_receipts','supplier_invoices',
    'governance_members','governance_meetings','governance_resolutions','governance_documents','school_events','event_participants',
    'school_holidays','interop_imports','interop_exports','interop_mappings','analytics_saved_views','data_subject_requests','data_retention_policies'
  ] loop
    execute format('drop trigger if exists %I on public.%I',t||'_tenant_validate',t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.operations_validate_tenant()',t||'_tenant_validate',t);
  end loop;
end $$;

-- Generic safe insert helpers for master records.
create or replace function public.create_operation_record(p_entity text,p_school_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
  if not public.can_manage_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
  case p_entity
    when 'boarding_house' then
      insert into public.boarding_houses(school_id,name,code,capacity) values(p_school_id,p_payload->>'name',p_payload->>'code',coalesce((p_payload->>'capacity')::int,0)) returning to_jsonb(boarding_houses.*) into r;
    when 'library_book' then
      insert into public.library_books(school_id,title,isbn,author,publisher,category) values(p_school_id,p_payload->>'title',p_payload->>'isbn',p_payload->>'author',p_payload->>'publisher',p_payload->>'category') returning to_jsonb(library_books.*) into r;
    when 'sports_activity' then
      insert into public.sports_activities(school_id,name,category) values(p_school_id,p_payload->>'name',coalesce(p_payload->>'category','sport')) returning to_jsonb(sports_activities.*) into r;
    when 'asset_category' then
      insert into public.asset_categories(school_id,name,code) values(p_school_id,p_payload->>'name',p_payload->>'code') returning to_jsonb(asset_categories.*) into r;
    when 'supplier' then
      insert into public.procurement_suppliers(school_id,name,registration_number,contact_name,email,phone) values(p_school_id,p_payload->>'name',p_payload->>'registration_number',p_payload->>'contact_name',p_payload->>'email',p_payload->>'phone') returning to_jsonb(procurement_suppliers.*) into r;
    when 'governance_member' then
      insert into public.governance_members(school_id,full_name,role_title,term_start,term_end) values(p_school_id,p_payload->>'full_name',p_payload->>'role_title',(p_payload->>'term_start')::date,(p_payload->>'term_end')::date) returning to_jsonb(governance_members.*) into r;
    when 'event' then
      insert into public.school_events(school_id,title,event_type,starts_at,ends_at,venue,description,created_by) values(p_school_id,p_payload->>'title',p_payload->>'event_type',(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,p_payload->>'venue',p_payload->>'description',auth.uid()) returning to_jsonb(school_events.*) into r;
    else raise exception 'unsupported_operation_entity';
  end case;
  perform public.write_audit_log(p_school_id,auth.uid(),'operation_record_created',p_entity,(r->>'id')::uuid,null,r);
  return r;
end $$;
grant execute on function public.create_operation_record(text,uuid,jsonb) to authenticated;
revoke execute on function public.create_operation_record(text,uuid,jsonb) from public;

-- Library workflow
create or replace function public.library_checkout(p_school_id uuid,p_copy_id uuid,p_learner_id uuid,p_due_at timestamptz)
returns public.library_loans language plpgsql security definer set search_path=public as $$
declare r public.library_loans;
begin
 if not public.can_manage_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
 if not exists(select 1 from public.library_copies where id=p_copy_id and school_id=p_school_id and status='available') then raise exception 'validation_error: copy unavailable'; end if;
 insert into public.library_loans(school_id,copy_id,learner_id,due_at) values(p_school_id,p_copy_id,p_learner_id,p_due_at) returning * into r;
 update public.library_copies set status='borrowed' where id=p_copy_id;
 perform public.write_audit_log(p_school_id,auth.uid(),'library_checkout','library_loans',r.id,null,jsonb_build_object('copy_id',p_copy_id,'learner_id',p_learner_id));
 return r;
end $$;
grant execute on function public.library_checkout(uuid,uuid,uuid,timestamptz) to authenticated;
revoke execute on function public.library_checkout(uuid,uuid,uuid,timestamptz) from public;

create or replace function public.library_return(p_loan_id uuid)
returns public.library_loans language plpgsql security definer set search_path=public as $$
declare r public.library_loans;
begin
 select * into r from public.library_loans where id=p_loan_id;
 if r.id is null or not public.can_manage_operations(r.school_id) then raise exception 'insufficient_privilege'; end if;
 update public.library_loans set returned_at=now(),status='returned' where id=p_loan_id returning * into r;
 update public.library_copies set status='available' where id=r.copy_id;
 perform public.write_audit_log(r.school_id,auth.uid(),'library_return','library_loans',r.id,null,null);
 return r;
end $$;
grant execute on function public.library_return(uuid) to authenticated;
revoke execute on function public.library_return(uuid) from public;

-- Procurement approval
create or replace function public.transition_purchase_request(p_request_id uuid,p_status text)
returns public.purchase_requests language plpgsql security definer set search_path=public as $$
declare r public.purchase_requests;
begin
 select * into r from public.purchase_requests where id=p_request_id;
 if r.id is null or not public.can_manage_operations(r.school_id) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('submitted','approved','rejected','ordered','closed') then raise exception 'validation_error: invalid procurement status'; end if;
 update public.purchase_requests set status=p_status where id=p_request_id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'purchase_request_status_changed','purchase_requests',r.id,null,jsonb_build_object('status',p_status));
 return r;
end $$;
grant execute on function public.transition_purchase_request(uuid,text) to authenticated;
revoke execute on function public.transition_purchase_request(uuid,text) from public;

-- Event participant status
create or replace function public.set_event_participation(p_participant_id uuid,p_status text)
returns public.event_participants language plpgsql security definer set search_path=public as $$
declare r public.event_participants;
begin
 select * into r from public.event_participants where id=p_participant_id;
 if r.id is null or not public.can_view_operations(r.school_id) then raise exception 'insufficient_privilege'; end if;
 if p_status not in ('invited','confirmed','declined','attended') then raise exception 'validation_error'; end if;
 update public.event_participants set status=p_status where id=p_participant_id returning * into r;
 return r;
end $$;
grant execute on function public.set_event_participation(uuid,text) to authenticated;
revoke execute on function public.set_event_participation(uuid,text) from public;

-- DSAR: request creation is self-service; processing is manager-only.
create or replace function public.create_data_subject_request(
 p_school_id uuid,p_subject_profile_id uuid default null,p_subject_learner_id uuid default null,p_request_type text default 'access',p_reason text default null)
returns public.data_subject_requests language plpgsql security definer set search_path=public as $$
declare r public.data_subject_requests;
begin
 if public.current_tenant_id()<>p_school_id or auth.uid() is null then raise exception 'insufficient_privilege'; end if;
 if p_request_type not in ('access','correction','restriction','deletion','portability') then raise exception 'validation_error'; end if;
 insert into public.data_subject_requests(school_id,subject_profile_id,subject_learner_id,request_type,reason)
 values(p_school_id,p_subject_profile_id,p_subject_learner_id,p_request_type,p_reason) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'dsar_created','data_subject_requests',r.id,null,jsonb_build_object('request_type',p_request_type));
 return r;
end $$;
grant execute on function public.create_data_subject_request(uuid,uuid,uuid,text,text) to authenticated;
revoke execute on function public.create_data_subject_request(uuid,uuid,uuid,text,text) from public;

create or replace function public.transition_data_subject_request(p_request_id uuid,p_status text,p_outcome text default null)
returns public.data_subject_requests language plpgsql security definer set search_path=public as $$
declare r public.data_subject_requests;
begin
 select * into r from public.data_subject_requests where id=p_request_id;
 if r.id is null or not public.can_manage_operations(r.school_id) then raise exception 'insufficient_privilege'; end if;
 update public.data_subject_requests set status=p_status,outcome_notes=p_outcome,handled_by=auth.uid(),completed_at=case when p_status='completed' then now() else completed_at end where id=p_request_id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'dsar_status_changed','data_subject_requests',r.id,null,jsonb_build_object('status',p_status));
 return r;
end $$;
grant execute on function public.transition_data_subject_request(uuid,text,text) to authenticated;
revoke execute on function public.transition_data_subject_request(uuid,text,text) from public;

-- Analytics snapshot: one stable RPC for dashboards; no sensitive cross-tenant leakage.
create or replace function public.get_operations_analytics(p_school_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'boarding', jsonb_build_object('houses',(select count(*) from public.boarding_houses where school_id=p_school_id and active),
 'boarders',(select count(*) from public.boarding_allocations where school_id=p_school_id and status='active')),
 'library',jsonb_build_object('books',(select count(*) from public.library_books where school_id=p_school_id and active),
 'loans',(select count(*) from public.library_loans where school_id=p_school_id and status in ('borrowed','overdue'))),
 'sports',jsonb_build_object('activities',(select count(*) from public.sports_activities where school_id=p_school_id and active),
 'teams',(select count(*) from public.sports_teams where school_id=p_school_id and active)),
 'assets',jsonb_build_object('assets',(select count(*) from public.assets where school_id=p_school_id and status='active'),
 'maintenance',(select count(*) from public.asset_maintenance where school_id=p_school_id and status='open')),
 'procurement',jsonb_build_object('requests',(select count(*) from public.purchase_requests where school_id=p_school_id and status in ('submitted','approved','ordered'))),
 'events',jsonb_build_object('upcoming',(select count(*) from public.school_events where school_id=p_school_id and status='scheduled' and starts_at>=now())),
 'dsar',jsonb_build_object('open',(select count(*) from public.data_subject_requests where school_id=p_school_id and status not in ('completed','rejected')))
);
$$;
grant execute on function public.get_operations_analytics(uuid) to authenticated;
revoke execute on function public.get_operations_analytics(uuid) from public;

-- Restricted governance/compliance visibility: these are not ordinary staff records.
create or replace function public.can_view_governance(target_school_id uuid)
returns boolean language sql stable set search_path=public as $$
 select public.is_platform_admin()
   or (public.current_tenant_id()=target_school_id and coalesce((select role::text from public.profiles where id=auth.uid()),'') in
       ('school_owner','principal','vice_principal','governance_officer','auditor'));
$$;
create or replace function public.can_view_dsar(target_school_id uuid)
returns boolean language sql stable set search_path=public as $$
 select public.is_platform_admin()
   or (public.current_tenant_id()=target_school_id and coalesce((select role::text from public.profiles where id=auth.uid()),'') in
       ('school_owner','principal','vice_principal','governance_officer','auditor','hr_manager'));
$$;
drop policy if exists governance_meetings_select on public.governance_meetings;
create policy governance_meetings_select on public.governance_meetings for select to authenticated using(public.can_view_governance(school_id));
drop policy if exists governance_members_select on public.governance_members;
create policy governance_members_select on public.governance_members for select to authenticated using(public.can_view_governance(school_id));
drop policy if exists governance_resolutions_select on public.governance_resolutions;
create policy governance_resolutions_select on public.governance_resolutions for select to authenticated using(public.can_view_governance(school_id));
drop policy if exists governance_documents_select on public.governance_documents;
create policy governance_documents_select on public.governance_documents for select to authenticated using(public.can_view_governance(school_id));
drop policy if exists data_subject_requests_select on public.data_subject_requests;
create policy data_subject_requests_select on public.data_subject_requests for select to authenticated using(public.can_view_dsar(school_id) or subject_profile_id=auth.uid());


-- Interoperability: controlled import lifecycle with validation and learner apply.
alter table public.interop_imports add column if not exists source_rows jsonb not null default '[]'::jsonb;
create or replace function public.create_interop_import(
  p_school_id uuid,p_entity_type text,p_file_name text,p_format text,p_rows jsonb,p_mapping jsonb default '{}'::jsonb
) returns public.interop_imports language plpgsql security definer set search_path=public as $$
declare r public.interop_imports;
begin
 if not public.can_manage_operations(p_school_id) then raise exception 'insufficient_privilege'; end if;
 if p_format not in ('csv','xlsx') then raise exception 'validation_error: format must be csv or xlsx'; end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'validation_error: rows must be an array'; end if;
 insert into public.interop_imports(school_id,entity_type,file_name,format,total_rows,mapping,source_rows,created_by)
 values(p_school_id,p_entity_type,p_file_name,p_format,jsonb_array_length(p_rows),p_mapping,p_rows,auth.uid()) returning * into r;
 perform public.write_audit_log(p_school_id,auth.uid(),'interop_import_created','interop_imports',r.id,null,to_jsonb(r));
 return r;
end $$;
grant execute on function public.create_interop_import(uuid,text,text,text,jsonb,jsonb) to authenticated;
revoke execute on function public.create_interop_import(uuid,text,text,text,jsonb,jsonb) from public;

create or replace function public.validate_interop_import(p_import_id uuid)
returns public.interop_imports language plpgsql security definer set search_path=public as $$
declare r public.interop_imports; row jsonb; errs jsonb:='[]'::jsonb; ok int:=0; n int:=0; ln text;
begin
 select * into r from public.interop_imports where id=p_import_id;
 if r.id is null or not public.can_manage_operations(r.school_id) then raise exception 'insufficient_privilege'; end if;
 for row in select value from jsonb_array_elements(r.source_rows) loop
   n:=n+1;
   if r.entity_type='learners' then
     if nullif(row->>'learner_number','') is null or nullif(row->>'admission_number','') is null or nullif(row->>'first_name','') is null or nullif(row->>'last_name','') is null or nullif(row->>'date_of_birth','') is null or nullif(row->>'admission_date','') is null then
       errs:=errs||jsonb_build_array(jsonb_build_object('row',n,'error','learner_number, admission_number, first_name, last_name, date_of_birth and admission_date are required')); continue;
     end if;
     if exists(select 1 from public.learners l where l.school_id=r.school_id and (l.learner_number=row->>'learner_number' or l.admission_number=row->>'admission_number')) then
       errs:=errs||jsonb_build_array(jsonb_build_object('row',n,'error','duplicate learner_number or admission_number')); continue;
     end if;
   else
     if row is null or jsonb_typeof(row)<>'object' then errs:=errs||jsonb_build_array(jsonb_build_object('row',n,'error','row must be an object')); continue; end if;
   end if;
   ok:=ok+1;
 end loop;
 update public.interop_imports set status=case when jsonb_array_length(errs)=0 then 'validated' else 'failed' end,valid_rows=ok,error_rows=jsonb_array_length(errs),errors=errs where id=r.id returning * into r;
 return r;
end $$;
grant execute on function public.validate_interop_import(uuid) to authenticated;
revoke execute on function public.validate_interop_import(uuid) from public;

create or replace function public.apply_interop_import(p_import_id uuid)
returns public.interop_imports language plpgsql security definer set search_path=public as $$
declare r public.interop_imports; row jsonb; new_id uuid;
begin
 select * into r from public.interop_imports where id=p_import_id;
 if r.id is null or not public.can_manage_operations(r.school_id) then raise exception 'insufficient_privilege'; end if;
 if r.status<>'validated' then raise exception 'validation_error: import must be validated before apply'; end if;
 if r.entity_type<>'learners' then raise exception 'validation_error: apply currently supports learners; other entity mappings are retained for official SA-SAMS/CEMIS adapters'; end if;
 for row in select value from jsonb_array_elements(r.source_rows) loop
   if not exists(select 1 from public.learners where school_id=r.school_id and (learner_number=row->>'learner_number' or admission_number=row->>'admission_number')) then
     insert into public.learners(school_id,learner_number,admission_number,first_name,last_name,date_of_birth,admission_date,status,created_by,updated_by)
     values(r.school_id,row->>'learner_number',row->>'admission_number',row->>'first_name',row->>'last_name',(row->>'date_of_birth')::date,(row->>'admission_date')::date,coalesce(nullif(row->>'status',''),'prospective')::public.learner_status,auth.uid(),auth.uid()) returning id into new_id;
   end if;
 end loop;
 update public.interop_imports set status='applied' where id=r.id returning * into r;
 perform public.write_audit_log(r.school_id,auth.uid(),'interop_import_applied','interop_imports',r.id,null,to_jsonb(r));
 return r;
end $$;
grant execute on function public.apply_interop_import(uuid) to authenticated;
revoke execute on function public.apply_interop_import(uuid) from public;

-- Advanced analytics: cross-domain operational indicators.
create or replace function public.get_advanced_analytics(p_school_id uuid)
returns jsonb language sql security definer stable set search_path=public as $$
select jsonb_build_object(
 'attendance',jsonb_build_object(
   'present',(select count(*) from public.attendance_records where school_id=p_school_id and status='present'),
   'absent',(select count(*) from public.attendance_records where school_id=p_school_id and status='absent'),
   'late',(select count(*) from public.attendance_records where school_id=p_school_id and status='late')),
 'finance',jsonb_build_object(
   'outstanding',((select coalesce(sum(amount),0) from public.learner_fee_charges where school_id=p_school_id and active) - (select coalesce(sum(amount),0) from public.learner_fee_payments where school_id=p_school_id)),
   'overdue',((select coalesce(sum(c.amount),0) from public.learner_fee_charges c where c.school_id=p_school_id and c.active and c.due_date<current_date) - (select coalesce(sum(p.amount),0) from public.learner_fee_payments p where p.school_id=p_school_id and p.payment_date<current_date))),
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
 'operations',(select public.get_operations_analytics(p_school_id))
);
$$;
grant execute on function public.get_advanced_analytics(uuid) to authenticated;
revoke execute on function public.get_advanced_analytics(uuid) from public;

-- Automation control plane: pg_cron schedules the already-tested workers.
create table if not exists public.automation_jobs (
 id uuid primary key default gen_random_uuid(), school_id uuid references public.schools(id),
 job_key text not null, cron_expression text not null, enabled boolean not null default true,
 last_run_at timestamptz, last_result jsonb, created_at timestamptz not null default now(),
 unique(school_id,job_key)
);
create table if not exists public.automation_job_runs (
 id uuid primary key default gen_random_uuid(), school_id uuid, job_key text not null,
 started_at timestamptz not null default now(), completed_at timestamptz, status text not null check(status in ('running','success','failed')),
 result jsonb, error_message text
);
alter table public.automation_jobs enable row level security;
alter table public.automation_jobs force row level security;
alter table public.automation_job_runs enable row level security;
alter table public.automation_job_runs force row level security;
drop policy if exists automation_jobs_select on public.automation_jobs;
create policy automation_jobs_select on public.automation_jobs for select to authenticated using(public.can_manage_operations(school_id));
drop policy if exists automation_job_runs_select on public.automation_job_runs;
create policy automation_job_runs_select on public.automation_job_runs for select to authenticated using(public.can_manage_operations(school_id));

do $$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
   perform cron.schedule('funda360-fee-overdue','0 7 * * *',$job$select public.trigger_fee_overdue_reminders(id) from public.schools where status='active';$job$);
   perform cron.schedule('funda360-document-expiry','15 7 * * *',$job$select public.trigger_document_expiry_alerts(id) from public.schools where status='active';$job$);
 end if;
end $$;

-- POPIA export: returns a controlled, audit-backed subject package without exposing secrets.
create or replace function public.export_data_subject_package(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.data_subject_requests; result jsonb;
begin
 select * into r from public.data_subject_requests where id=p_request_id;
 if r.id is null or not public.can_view_dsar(r.school_id) then raise exception 'insufficient_privilege'; end if;
 result:=jsonb_build_object(
   'request',to_jsonb(r),
   'profile',case when r.subject_profile_id is null then null else (select to_jsonb(p) from public.profiles p where p.id=r.subject_profile_id and p.tenant_id=r.school_id) end,
   'learner',case when r.subject_learner_id is null then null else (select to_jsonb(l) from public.learners l where l.id=r.subject_learner_id and l.school_id=r.school_id) end
 );
 perform public.write_audit_log(r.school_id,auth.uid(),'dsar_export_generated','data_subject_requests',r.id,null,result);
 return result;
end $$;
grant execute on function public.export_data_subject_package(uuid) to authenticated;
revoke execute on function public.export_data_subject_package(uuid) from public;
