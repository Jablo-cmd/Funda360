-- Funda360 Next Generation Platform
-- Additive only: intelligence, learner success, family, identity, safety,
-- AI teaching, workflows, documents, trust, group control and ecosystem foundations.
-- All writes are tenant scoped and RLS protected.

create table if not exists public.funda_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  learner_id uuid not null references public.learners(id),
  risk_level text not null default 'watch' check (risk_level in ('stable','watch','intervention','critical')),
  risk_score numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  factors jsonb not null default '[]'::jsonb,
  recommended_action text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, learner_id)
);

create table if not exists public.funda_interventions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  learner_id uuid not null references public.learners(id),
  risk_profile_id uuid references public.funda_risk_profiles(id),
  title text not null,
  objective text,
  owner_profile_id uuid references public.profiles(id),
  status text not null default 'open' check (status in ('open','in_progress','on_track','at_risk','resolved','closed')),
  target_date date,
  review_date date,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funda_intervention_updates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  intervention_id uuid not null references public.funda_interventions(id),
  note text not null,
  progress integer not null default 0 check (progress between 0 and 100),
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.funda_family_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  learner_id uuid references public.learners(id),
  guardian_id uuid references public.profiles(id),
  event_type text not null,
  title text not null,
  body text,
  channel text not null default 'in_app' check (channel in ('in_app','email','sms','whatsapp','push')),
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.funda_ids (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  learner_id uuid not null references public.learners(id),
  card_number text not null,
  qr_token text not null,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(school_id, card_number),
  unique(qr_token)
);

create table if not exists public.funda_gate_scans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  learner_id uuid not null references public.learners(id),
  funda_id uuid references public.funda_ids(id),
  gate text not null,
  direction text not null check (direction in ('in','out')),
  scanned_at timestamptz not null default now(),
  method text not null default 'qr' check (method in ('qr','nfc','manual')),
  verified_by uuid references public.profiles(id),
  notes text
);

create table if not exists public.funda_health_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  learner_id uuid not null references public.learners(id),
  record_type text not null,
  summary text not null,
  allergies text,
  medication text,
  emergency_action text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funda_ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  artifact_type text not null check (artifact_type in ('lesson_plan','assessment','quiz','memo','report_comment','copilot_answer')),
  title text not null,
  prompt text not null,
  output jsonb not null default '{}'::jsonb,
  model text not null default 'rules',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.funda_workflows (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  trigger_event text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(school_id,name)
);

create table if not exists public.funda_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  workflow_id uuid not null references public.funda_workflows(id),
  status text not null check (status in ('queued','running','succeeded','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.funda_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  learner_id uuid references public.learners(id),
  title text not null,
  document_type text not null,
  storage_path text,
  expires_on date,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  visibility text not null default 'restricted' check (visibility in ('restricted','guardian','staff')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.funda_localisation (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  locale text not null,
  label_key text not null,
  label_value text not null,
  active boolean not null default true,
  unique(school_id,locale,label_key)
);

create table if not exists public.funda_group_schools (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  school_id uuid not null references public.schools(id),
  role text not null default 'member' check (role in ('head_office','member')),
  active boolean not null default true,
  unique(group_id,school_id)
);

create table if not exists public.funda_integrations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  integration_key text not null,
  display_name text not null,
  status text not null default 'configured' check (status in ('configured','connected','paused','error')),
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  unique(school_id,integration_key)
);

create table if not exists public.funda_api_clients (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  active boolean not null default true,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.funda_sandboxes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  status text not null default 'active' check (status in ('active','archived')),
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.funda_apps (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  name text not null,
  category text not null,
  description text,
  publisher text,
  status text not null default 'available' check (status in ('available','installed','disabled')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funda_risk_school_idx on public.funda_risk_profiles(school_id,risk_level,risk_score desc);
create index if not exists funda_interventions_school_idx on public.funda_interventions(school_id,status,target_date);
create index if not exists funda_family_events_school_idx on public.funda_family_events(school_id,status,scheduled_at);
create index if not exists funda_gate_scans_school_idx on public.funda_gate_scans(school_id,scanned_at desc);
create index if not exists funda_health_school_idx on public.funda_health_records(school_id,learner_id);
create index if not exists funda_ai_school_idx on public.funda_ai_artifacts(school_id,created_at desc);
create index if not exists funda_workflows_school_idx on public.funda_workflows(school_id,enabled);
create index if not exists funda_documents_school_idx on public.funda_documents(school_id,status,expires_on);
create index if not exists funda_integrations_school_idx on public.funda_integrations(school_id,status);

create or replace function public.funda_can_manage(p_school_id uuid)
returns boolean language sql stable set search_path=public as $$
  select public.can_manage_operations(p_school_id)
$$;

create or replace function public.funda_command_center(p_school_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare
  result jsonb;
  r record;
begin
  if not public.can_view_operations(p_school_id) then
    raise exception 'Not authorised for this school';
  end if;

  select jsonb_build_object(
    'school_id', p_school_id,
    'risk', jsonb_build_object(
      'stable', (select count(*) from public.funda_risk_profiles where school_id=p_school_id and risk_level='stable'),
      'watch', (select count(*) from public.funda_risk_profiles where school_id=p_school_id and risk_level='watch'),
      'intervention', (select count(*) from public.funda_risk_profiles where school_id=p_school_id and risk_level='intervention'),
      'critical', (select count(*) from public.funda_risk_profiles where school_id=p_school_id and risk_level='critical')
    ),
    'interventions', jsonb_build_object(
      'open', (select count(*) from public.funda_interventions where school_id=p_school_id and status in ('open','in_progress','at_risk')),
      'resolved', (select count(*) from public.funda_interventions where school_id=p_school_id and status in ('resolved','closed'))
    ),
    'family', jsonb_build_object(
      'queued', (select count(*) from public.funda_family_events where school_id=p_school_id and status='queued'),
      'sent', (select count(*) from public.funda_family_events where school_id=p_school_id and status in ('sent','delivered'))
    ),
    'gate', jsonb_build_object(
      'today', (select count(*) from public.funda_gate_scans where school_id=p_school_id and scanned_at::date=current_date),
      'entries_today', (select count(*) from public.funda_gate_scans where school_id=p_school_id and direction='in' and scanned_at::date=current_date),
      'exits_today', (select count(*) from public.funda_gate_scans where school_id=p_school_id and direction='out' and scanned_at::date=current_date)
    ),
    'documents', jsonb_build_object(
      'active', (select count(*) from public.funda_documents where school_id=p_school_id and status='active'),
      'expiring_30d', (select count(*) from public.funda_documents where school_id=p_school_id and expires_on between current_date and current_date+30)
    ),
    'workflows', jsonb_build_object(
      'enabled', (select count(*) from public.funda_workflows where school_id=p_school_id and enabled),
      'runs_today', (select count(*) from public.funda_workflow_runs where school_id=p_school_id and started_at::date=current_date)
    ),
    'integrations', jsonb_build_object(
      'connected', (select count(*) from public.funda_integrations where school_id=p_school_id and status='connected'),
      'attention', (select count(*) from public.funda_integrations where school_id=p_school_id and status in ('error','paused'))
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.funda_calculate_risk(
  p_school_id uuid,
  p_learner_id uuid,
  p_attendance_rate numeric default 100,
  p_average_mark numeric default 100,
  p_behaviour_events integer default 0
)
returns jsonb language plpgsql set search_path=public as $$
declare
  score numeric := 0;
  level text := 'stable';
  factors jsonb := '[]'::jsonb;
  rec text := 'Continue normal monitoring.';
  rid uuid;
begin
  if not public.funda_can_manage(p_school_id) then raise exception 'Not authorised'; end if;
  if p_attendance_rate < 80 then score := score + 45; factors := factors || jsonb_build_array('Attendance below 80%'); end if;
  if p_attendance_rate >= 80 and p_attendance_rate < 90 then score := score + 25; factors := factors || jsonb_build_array('Attendance below 90%'); end if;
  if p_average_mark < 40 then score := score + 40; factors := factors || jsonb_build_array('Average below 40%'); end if;
  if p_average_mark >= 40 and p_average_mark < 50 then score := score + 25; factors := factors || jsonb_build_array('Average below 50%'); end if;
  if p_behaviour_events >= 3 then score := score + least(30,p_behaviour_events*5); factors := factors || jsonb_build_array('Repeated behaviour events'); end if;
  if score >= 70 then level := 'critical'; rec := 'Immediate multidisciplinary intervention recommended.';
  elsif score >= 45 then level := 'intervention'; rec := 'Create and review a learner intervention.';
  elsif score >= 20 then level := 'watch'; rec := 'Increase monitoring and parent/teacher engagement.';
  end if;
  insert into public.funda_risk_profiles(school_id,learner_id,risk_level,risk_score,factors,recommended_action,reviewed_at,reviewed_by)
  values(p_school_id,p_learner_id,level,least(score,100),factors,rec,now(),auth.uid())
  on conflict(school_id,learner_id) do update set risk_level=excluded.risk_level,risk_score=excluded.risk_score,factors=excluded.factors,recommended_action=excluded.recommended_action,reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,updated_at=now()
  returning id into rid;
  return jsonb_build_object('id',rid,'risk_level',level,'risk_score',least(score,100),'factors',factors,'recommended_action',rec);
end;
$$;

create or replace function public.funda_record_gate_scan(
  p_school_id uuid,p_learner_id uuid,p_gate text,p_direction text,p_method text default 'qr'
)
returns uuid language plpgsql set search_path=public as $$
declare sid uuid;
begin
  if not public.funda_can_manage(p_school_id) then raise exception 'Not authorised'; end if;
  insert into public.funda_gate_scans(school_id,learner_id,gate,direction,method,verified_by)
  values(p_school_id,p_learner_id,p_gate,p_direction,p_method,auth.uid()) returning id into sid;
  return sid;
end;
$$;

create or replace function public.funda_create_workflow(
  p_school_id uuid,p_name text,p_trigger_event text,p_conditions jsonb,p_actions jsonb
)
returns uuid language plpgsql set search_path=public as $$
declare wid uuid;
begin
  if not public.funda_can_manage(p_school_id) then raise exception 'Not authorised'; end if;
  insert into public.funda_workflows(school_id,name,trigger_event,conditions,actions,created_by)
  values(p_school_id,p_name,p_trigger_event,coalesce(p_conditions,'{}'),coalesce(p_actions,'[]'),auth.uid())
  on conflict(school_id,name) do update set trigger_event=excluded.trigger_event,conditions=excluded.conditions,actions=excluded.actions,enabled=true
  returning id into wid;
  return wid;
end;
$$;

create or replace function public.funda_ai_copilot(p_school_id uuid,p_question text)
returns jsonb language plpgsql stable set search_path=public as $$
declare
  critical_count integer;
  open_interventions integer;
  queued integer;
  answer text;
begin
  if not public.can_view_operations(p_school_id) then raise exception 'Not authorised'; end if;
  select count(*) into critical_count from public.funda_risk_profiles where school_id=p_school_id and risk_level='critical';
  select count(*) into open_interventions from public.funda_interventions where school_id=p_school_id and status in ('open','in_progress','at_risk');
  select count(*) into queued from public.funda_family_events where school_id=p_school_id and status='queued';
  answer := format('For this school, Funda360 currently has %s critical learner risks, %s active interventions and %s queued family communications. Priority: review critical risks, then overdue interventions, then queued communications.',critical_count,open_interventions,queued);
  insert into public.funda_ai_artifacts(school_id,artifact_type,title,prompt,output,model,created_by)
  values(p_school_id,'copilot_answer','Funda Copilot',p_question,jsonb_build_object('answer',answer,'source','live_school_metrics'),'rules',auth.uid());
  return jsonb_build_object('answer',answer,'source','live_school_metrics','model','rules');
end;
$$;

alter table public.funda_risk_profiles enable row level security;
alter table public.funda_interventions enable row level security;
alter table public.funda_intervention_updates enable row level security;
alter table public.funda_family_events enable row level security;
alter table public.funda_ids enable row level security;
alter table public.funda_gate_scans enable row level security;
alter table public.funda_health_records enable row level security;
alter table public.funda_ai_artifacts enable row level security;
alter table public.funda_workflows enable row level security;
alter table public.funda_workflow_runs enable row level security;
alter table public.funda_documents enable row level security;
alter table public.funda_localisation enable row level security;
alter table public.funda_group_schools enable row level security;
alter table public.funda_integrations enable row level security;
alter table public.funda_api_clients enable row level security;
alter table public.funda_sandboxes enable row level security;
alter table public.funda_apps enable row level security;

create policy "funda risk view" on public.funda_risk_profiles for select to authenticated using(public.can_view_operations(school_id));
create policy "funda risk manage" on public.funda_risk_profiles for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda interventions view" on public.funda_interventions for select to authenticated using(public.can_view_operations(school_id));
create policy "funda interventions manage" on public.funda_interventions for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda intervention updates view" on public.funda_intervention_updates for select to authenticated using(public.can_view_operations(school_id));
create policy "funda intervention updates manage" on public.funda_intervention_updates for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda family view" on public.funda_family_events for select to authenticated using(public.can_view_operations(school_id));
create policy "funda family manage" on public.funda_family_events for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda ids view" on public.funda_ids for select to authenticated using(public.can_view_operations(school_id));
create policy "funda ids manage" on public.funda_ids for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda gate view" on public.funda_gate_scans for select to authenticated using(public.can_view_operations(school_id));
create policy "funda gate manage" on public.funda_gate_scans for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda health view" on public.funda_health_records for select to authenticated using(public.can_view_operations(school_id) and coalesce((select role::text from public.profiles where id=auth.uid()),'') in ('medical_officer','principal','school_owner','platform_owner','platform_administrator','super_administrator'));
create policy "funda health manage" on public.funda_health_records for all to authenticated using(public.funda_can_manage(school_id) and coalesce((select role::text from public.profiles where id=auth.uid()),'') in ('medical_officer','principal','school_owner','platform_owner','platform_administrator','super_administrator')) with check(public.funda_can_manage(school_id) and coalesce((select role::text from public.profiles where id=auth.uid()),'') in ('medical_officer','principal','school_owner','platform_owner','platform_administrator','super_administrator'));
create policy "funda ai view" on public.funda_ai_artifacts for select to authenticated using(public.can_view_operations(school_id));
create policy "funda ai manage" on public.funda_ai_artifacts for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda workflows view" on public.funda_workflows for select to authenticated using(public.can_view_operations(school_id));
create policy "funda workflows manage" on public.funda_workflows for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda workflow runs view" on public.funda_workflow_runs for select to authenticated using(public.can_view_operations(school_id));
create policy "funda workflow runs manage" on public.funda_workflow_runs for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda documents view" on public.funda_documents for select to authenticated using(public.can_view_operations(school_id));
create policy "funda documents manage" on public.funda_documents for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda localisation view" on public.funda_localisation for select to authenticated using(public.can_view_operations(school_id));
create policy "funda localisation manage" on public.funda_localisation for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda group schools view" on public.funda_group_schools for select to authenticated using(public.can_view_operations(school_id));
create policy "funda group schools manage" on public.funda_group_schools for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda integrations view" on public.funda_integrations for select to authenticated using(public.can_view_operations(school_id));
create policy "funda integrations manage" on public.funda_integrations for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda api clients view" on public.funda_api_clients for select to authenticated using(public.can_view_operations(school_id));
create policy "funda api clients manage" on public.funda_api_clients for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda sandboxes view" on public.funda_sandboxes for select to authenticated using(public.can_view_operations(school_id));
create policy "funda sandboxes manage" on public.funda_sandboxes for all to authenticated using(public.funda_can_manage(school_id)) with check(public.funda_can_manage(school_id));
create policy "funda apps view" on public.funda_apps for select to authenticated using(school_id is null or public.can_view_operations(school_id));
create policy "funda apps manage" on public.funda_apps for all to authenticated using(school_id is null or public.funda_can_manage(school_id)) with check(school_id is null or public.funda_can_manage(school_id));

grant execute on function public.funda_command_center(uuid) to authenticated;
grant execute on function public.funda_calculate_risk(uuid,uuid,numeric,numeric,integer) to authenticated;
grant execute on function public.funda_record_gate_scan(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.funda_create_workflow(uuid,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.funda_ai_copilot(uuid,text) to authenticated;
revoke execute on function public.funda_command_center(uuid) from anon;
revoke execute on function public.funda_calculate_risk(uuid,uuid,numeric,numeric,integer) from anon;
revoke execute on function public.funda_record_gate_scan(uuid,uuid,text,text,text) from anon;
revoke execute on function public.funda_create_workflow(uuid,text,text,jsonb,jsonb) from anon;
revoke execute on function public.funda_ai_copilot(uuid,text) from anon;

comment on table public.funda_risk_profiles is 'Learner early-warning and explainable risk signals.';
comment on table public.funda_ai_artifacts is 'Auditable AI/copilot outputs; external model use is optional and never bypasses RLS.';
comment on table public.funda_integrations is 'Integration registry; live provider connection requires school/provider credentials.';

create or replace function public.funda_validate_learner_school()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.learner_id is not null and not exists (
    select 1 from public.learners l where l.id=new.learner_id and l.school_id=new.school_id
  ) then
    raise exception 'Learner does not belong to school';
  end if;
  return new;
end;
$$;

drop trigger if exists funda_risk_learner_school on public.funda_risk_profiles;
create trigger funda_risk_learner_school before insert or update on public.funda_risk_profiles for each row execute function public.funda_validate_learner_school();
drop trigger if exists funda_intervention_learner_school on public.funda_interventions;
create trigger funda_intervention_learner_school before insert or update on public.funda_interventions for each row execute function public.funda_validate_learner_school();
drop trigger if exists funda_family_learner_school on public.funda_family_events;
create trigger funda_family_learner_school before insert or update on public.funda_family_events for each row execute function public.funda_validate_learner_school();
drop trigger if exists funda_id_learner_school on public.funda_ids;
create trigger funda_id_learner_school before insert or update on public.funda_ids for each row execute function public.funda_validate_learner_school();
drop trigger if exists funda_gate_learner_school on public.funda_gate_scans;
create trigger funda_gate_learner_school before insert or update on public.funda_gate_scans for each row execute function public.funda_validate_learner_school();
drop trigger if exists funda_health_learner_school on public.funda_health_records;
create trigger funda_health_learner_school before insert or update on public.funda_health_records for each row execute function public.funda_validate_learner_school();
drop trigger if exists funda_document_learner_school on public.funda_documents;
create trigger funda_document_learner_school before insert or update on public.funda_documents for each row execute function public.funda_validate_learner_school();

