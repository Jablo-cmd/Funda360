-- Funda AI pre-pilot hardening (audit of 2026-10-09). Forward-only; changes
-- 20261011090000_funda_ai_foundation without editing it.
--
--   H1  Rate limits and budgets are decided under per-user and per-school
--       advisory locks, so parallel requests are serialised. Budget is
--       RESERVED when a request starts (ai_start_request, service role) and
--       SETTLED on completion; reservations of requests that never finish
--       stay charged (conservative) until reconciled.
--   H3  Requests that never finish are closed by ai_recover_stale_requests()
--       (pg_cron, every minute): started-but-silent requests -> failed,
--       usage estimated (reservation kept); never-started -> failed, nothing
--       charged.
--   M3  The current message and the conversation history have separate
--       allowances (max_input_chars / max_history_chars).
--   M4  Budgets are never unlimited: a feature-level school budget and a
--       per-user monthly budget are required. ai_admin_set_school keeps
--       settings that are not passed. A school's feature list is explicit
--       (empty = none); NULL no longer means "every feature".
--   M5  ai_purge_expired() also expires feedback and is scheduled daily.
--   L1  ai_authorize_request() returns only allowed / reason / request_id
--       (the policy goes to the Edge Function through ai_start_request) and
--       stops recording blocked attempts beyond 20 per user per minute.
--   H2  (database half) ai_requests accepts 'policy_blocked' for requests
--       stopped by a content policy (e.g. medical information).

-- ===========================================================================
-- 1. Columns
-- ===========================================================================

alter table public.ai_features
  add column max_history_chars integer not null default 12000
    check (max_history_chars between 0 and 50000),
  add column request_token_reservation integer not null default 120000
    check (request_token_reservation between 1000 and 2000000),
  add column user_monthly_token_budget bigint not null default 500000
    check (user_monthly_token_budget > 0),
  add column medical_content_policy text not null default 'block'
    check (medical_content_policy in ('block', 'allow')),
  add column feedback_retention_days integer not null default 180
    check (feedback_retention_days between 1 and 3650);

comment on column public.ai_features.request_token_reservation is
  'Tokens reserved against the school and user budgets when a request starts; replaced by actual usage on completion. Requests that never report usage keep the reservation (conservative).';

update public.ai_features set school_monthly_token_budget = 3000000 where school_monthly_token_budget is null;
alter table public.ai_features
  alter column school_monthly_token_budget set default 3000000,
  alter column school_monthly_token_budget set not null;

-- A school's feature list is explicit. Existing NULL ("all") rows are
-- converted to the features that exist now, so nothing changes silently.
update public.ai_school_settings
   set enabled_features = coalesce((select array_agg(key order by key) from public.ai_features), '{}')
 where enabled_features is null;
alter table public.ai_school_settings
  alter column enabled_features set default '{}',
  alter column enabled_features set not null;
comment on column public.ai_school_settings.enabled_features is
  'The feature keys enabled for this school. Empty means none.';

alter table public.ai_requests
  add column history_chars   integer not null default 0,
  add column started_at      timestamptz,
  add column reserved_tokens bigint not null default 0,
  add column charged_tokens  bigint not null default 0,
  add column usage_estimated boolean not null default false;

comment on column public.ai_requests.charged_tokens is
  'What counts against budgets: the reservation while running, actual tokens once settled, the reservation when usage is unknown (usage_estimated).';

update public.ai_requests set charged_tokens = coalesce(input_tokens, 0) + coalesce(output_tokens, 0);

alter table public.ai_requests drop constraint ai_requests_status_check;
alter table public.ai_requests add constraint ai_requests_status_check
  check (status in ('authorized', 'blocked', 'succeeded', 'failed', 'safety_escalated', 'policy_blocked'));

create index ai_requests_open_idx on public.ai_requests (created_at) where status = 'authorized';
create index ai_requests_user_month_idx on public.ai_requests (user_id, created_at) include (charged_tokens);

-- ===========================================================================
-- 2. Policy gate (runs as the caller)
-- ===========================================================================

drop function public.ai_authorize_request(text, integer, text);

create function public.ai_lock(p_scope text, p_id uuid)
returns void
language sql
volatile
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtextextended('funda_ai:' || p_scope || ':' || p_id::text, 0))
$$;

-- Records the decision; never raises for a policy outcome. Returns only
-- { allowed, reason?, request_id? }: limits, tools and prompt ids are not
-- disclosed to the caller. Lock order is always user, then school.
create function public.ai_authorize_request(
  p_feature text,
  p_input_chars integer,
  p_client_request_id text default null,
  p_history_chars integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.ai_caller_role();
  v_school uuid := public.current_tenant_id();
  v_feature public.ai_features;
  v_settings public.ai_school_settings;
  v_reason text;
  v_count integer;
  v_budget bigint;
  v_used bigint;
  v_id uuid;
  v_client text := case when p_client_request_id ~ '^[A-Za-z0-9._:-]{8,64}$' then p_client_request_id end;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    return jsonb_build_object('allowed', false, 'reason', 'profile_inactive');
  end if;

  select * into v_feature from public.ai_features where key = p_feature;
  if v_feature.key is null then
    return jsonb_build_object('allowed', false, 'reason', 'feature_disabled');
  end if;

  -- Serialise this user's decisions so concurrent requests see each other.
  perform public.ai_lock('user', v_uid);

  if not v_feature.enabled then
    v_reason := 'feature_disabled';
  elsif not (v_role = any (v_feature.allowed_roles)) then
    v_reason := 'role_not_allowed';
  elsif v_school is null and not v_feature.allow_without_school then
    v_reason := 'school_context_required';
  elsif v_school is not null then
    select * into v_settings from public.ai_school_settings where school_id = v_school;
    if v_settings.school_id is null or not v_settings.enabled or not (p_feature = any (v_settings.enabled_features)) then
      v_reason := 'school_not_enabled';
    end if;
  end if;

  if v_reason is null and (coalesce(p_input_chars, 0) > v_feature.max_input_chars
                           or coalesce(p_history_chars, 0) > v_feature.max_history_chars) then
    v_reason := 'input_too_large';
  end if;

  if v_reason is null and v_school is not null then
    perform public.ai_lock('school', v_school);
  end if;

  if v_reason is null then
    select count(*) into v_count from public.ai_requests
    where user_id = v_uid and created_at > now() - interval '1 minute' and status <> 'blocked';
    if v_count >= v_feature.user_requests_per_minute then
      v_reason := 'rate_limited';
    end if;
  end if;
  if v_reason is null then
    select count(*) into v_count from public.ai_requests
    where user_id = v_uid and created_at > now() - interval '1 day' and status <> 'blocked';
    if v_count >= v_feature.user_requests_per_day then
      v_reason := 'rate_limited';
    end if;
  end if;
  if v_reason is null and v_school is not null then
    select count(*) into v_count from public.ai_requests
    where school_id = v_school and created_at > now() - interval '1 day' and status <> 'blocked';
    if v_count >= v_feature.school_requests_per_day then
      v_reason := 'rate_limited';
    end if;
  end if;

  -- Budget pre-check (the reservation itself happens in ai_start_request).
  if v_reason is null then
    select coalesce(sum(charged_tokens), 0) into v_used from public.ai_requests
    where user_id = v_uid and created_at >= date_trunc('month', now());
    if v_used + v_feature.request_token_reservation > v_feature.user_monthly_token_budget then
      v_reason := 'budget_exhausted';
    end if;
  end if;
  if v_reason is null and v_school is not null then
    v_budget := coalesce(v_settings.monthly_token_budget, v_feature.school_monthly_token_budget);
    select coalesce(sum(charged_tokens), 0) into v_used from public.ai_requests
    where school_id = v_school and created_at >= date_trunc('month', now());
    if v_used + v_feature.request_token_reservation > v_budget then
      v_reason := 'budget_exhausted';
    end if;
  end if;

  if v_reason is not null then
    -- Audit blocked attempts, but not without limit (direct RPC flooding).
    select count(*) into v_count from public.ai_requests
    where user_id = v_uid and status = 'blocked' and created_at > now() - interval '1 minute';
    if v_count >= 20 then
      return jsonb_build_object('allowed', false, 'reason', v_reason);
    end if;
  end if;

  insert into public.ai_requests (user_id, school_id, role, feature, status, block_reason, client_request_id, input_chars,
                                  history_chars, model_tier, prompt_id, human_approval)
  values (v_uid, v_school, v_role, p_feature, case when v_reason is null then 'authorized' else 'blocked' end, v_reason,
          v_client, greatest(coalesce(p_input_chars, 0), 0), greatest(coalesce(p_history_chars, 0), 0),
          v_feature.model_tier, v_feature.prompt_id,
          case when v_feature.requires_human_approval then 'required' else 'not_required' end)
  returning id into v_id;

  if v_reason is not null then
    return jsonb_build_object('allowed', false, 'reason', v_reason, 'request_id', v_id);
  end if;
  return jsonb_build_object('allowed', true, 'request_id', v_id);
end;
$$;

-- ===========================================================================
-- 3. Start, settle, recover (service role: the funda-ai Edge Function / cron)
-- ===========================================================================

-- Reserves budget for an authorised request and returns its policy. Single
-- use, and only within 2 minutes of authorisation. Re-checks both budgets
-- under the same locks, so concurrent starts cannot overspend.
create function public.ai_start_request(p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_req public.ai_requests;
  v_feature public.ai_features;
  v_settings public.ai_school_settings;
  v_used bigint;
  v_reason text;
begin
  select * into v_req from public.ai_requests where id = p_request_id;
  if v_req.id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;
  perform public.ai_lock('user', v_req.user_id);
  if v_req.school_id is not null then
    perform public.ai_lock('school', v_req.school_id);
  end if;

  select * into v_req from public.ai_requests where id = p_request_id for update;
  if v_req.status <> 'authorized' or v_req.started_at is not null or v_req.created_at < now() - interval '2 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;
  select * into v_feature from public.ai_features where key = v_req.feature;

  select coalesce(sum(charged_tokens), 0) into v_used from public.ai_requests
  where user_id = v_req.user_id and created_at >= date_trunc('month', now());
  if v_used + v_feature.request_token_reservation > v_feature.user_monthly_token_budget then
    v_reason := 'budget_exhausted';
  end if;
  if v_reason is null and v_req.school_id is not null then
    select * into v_settings from public.ai_school_settings where school_id = v_req.school_id;
    select coalesce(sum(charged_tokens), 0) into v_used from public.ai_requests
    where school_id = v_req.school_id and created_at >= date_trunc('month', now());
    if v_used + v_feature.request_token_reservation
       > coalesce(v_settings.monthly_token_budget, v_feature.school_monthly_token_budget) then
      v_reason := 'budget_exhausted';
    end if;
  end if;

  if v_reason is not null then
    update public.ai_requests set status = 'blocked', block_reason = v_reason, completed_at = now() where id = p_request_id;
    return jsonb_build_object('ok', false, 'reason', v_reason);
  end if;

  update public.ai_requests
     set started_at = now(), reserved_tokens = v_feature.request_token_reservation,
         charged_tokens = v_feature.request_token_reservation
   where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'principal', jsonb_build_object('user_id', v_req.user_id, 'school_id', v_req.school_id, 'role', v_req.role),
    'policy', jsonb_build_object(
      'feature', v_feature.key,
      'prompt_id', v_feature.prompt_id,
      'model_tier', v_feature.model_tier,
      'allowed_tools', to_jsonb(v_feature.allowed_tools),
      'max_input_chars', v_feature.max_input_chars,
      'max_history_chars', v_feature.max_history_chars,
      'max_output_tokens', v_feature.max_output_tokens,
      'medical_content_policy', v_feature.medical_content_policy,
      'store_content', v_feature.store_content,
      'content_retention_days', v_feature.content_retention_days,
      'requires_human_approval', v_feature.requires_human_approval
    )
  );
end;
$$;

-- Settles a request. p_usage_unknown: a provider call was in flight when the
-- request ended (timeout, abort, crash), so the provider may have billed
-- tokens we never saw: keep at least the reservation and mark it estimated.
drop function public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text);

create function public.ai_complete_request(
  p_request_id uuid,
  p_status text,
  p_provider text,
  p_model text,
  p_prompt_id text,
  p_prompt_version integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_micros bigint,
  p_duration_ms integer,
  p_safety_flags text[],
  p_error_code text,
  p_usage_unknown boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actual bigint := coalesce(p_input_tokens, 0) + coalesce(p_output_tokens, 0);
begin
  if p_status not in ('succeeded', 'failed', 'safety_escalated', 'policy_blocked') then
    raise exception 'invalid_argument: unknown completion status';
  end if;
  update public.ai_requests
     set status = p_status, provider = left(p_provider, 40), model = left(p_model, 80),
         prompt_id = coalesce(left(p_prompt_id, 60), prompt_id), prompt_version = p_prompt_version,
         input_tokens = p_input_tokens, output_tokens = p_output_tokens, estimated_cost_micros = p_estimated_cost_micros,
         duration_ms = p_duration_ms, safety_flags = coalesce(p_safety_flags, '{}'), error_code = left(p_error_code, 80),
         charged_tokens = case when coalesce(p_usage_unknown, false) then greatest(v_actual, reserved_tokens) else v_actual end,
         usage_estimated = coalesce(p_usage_unknown, false),
         completed_at = now()
   where id = p_request_id and status = 'authorized';
end;
$$;

-- Closes requests that never reported back (function killed, crashed or
-- timed out at the platform). Started ones keep their reservation charged
-- (usage unknown, so assume the worst); never-started ones (e.g. a direct
-- RPC call that never reached the gateway) are charged nothing.
create function public.ai_recover_stale_requests()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_started integer;
  v_never integer;
begin
  update public.ai_requests
     set status = 'failed', error_code = 'stale_request', usage_estimated = true,
         charged_tokens = greatest(charged_tokens, reserved_tokens), completed_at = now()
   where status = 'authorized' and started_at is not null and started_at < now() - interval '5 minutes';
  get diagnostics v_started = row_count;
  update public.ai_requests
     set status = 'failed', error_code = 'never_started', charged_tokens = 0, completed_at = now()
   where status = 'authorized' and started_at is null and created_at < now() - interval '2 minutes';
  get diagnostics v_never = row_count;
  return jsonb_build_object('stale_started', v_started, 'never_started', v_never);
end;
$$;

-- Retention: expired conversations, feedback past the feature's feedback
-- retention, and request rows (with their tool calls and feedback) past the
-- audit retention.
create or replace function public.ai_purge_expired()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_conv integer;
  v_feedback integer;
  v_req integer;
begin
  delete from public.ai_conversations where expires_at < now();
  get diagnostics v_conv = row_count;
  delete from public.ai_feedback fb using public.ai_requests r, public.ai_features f
  where r.id = fb.request_id and f.key = r.feature
    and fb.created_at < now() - make_interval(days => f.feedback_retention_days);
  get diagnostics v_feedback = row_count;
  delete from public.ai_requests r using public.ai_features f
  where f.key = r.feature and r.created_at < now() - make_interval(days => f.audit_retention_days)
    and r.status <> 'authorized';
  get diagnostics v_req = row_count;
  return jsonb_build_object('conversations', v_conv, 'feedback', v_feedback, 'requests', v_req);
end;
$$;

-- ===========================================================================
-- 4. Launcher list and administration
-- ===========================================================================

create or replace function public.ai_my_features()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', f.key, 'name', f.name, 'description', f.description) order by f.name), '[]'::jsonb)
  from public.ai_features f
  where f.enabled
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    and public.ai_caller_role() = any (f.allowed_roles)
    and (
      (public.current_tenant_id() is null and f.allow_without_school)
      or exists (
        select 1 from public.ai_school_settings s
        where s.school_id = public.current_tenant_id() and s.enabled and f.key = any (s.enabled_features)
      )
    )
$$;

create or replace function public.ai_admin_update_feature(p_key text, p_patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_before public.ai_features;
  v_patch jsonb := coalesce(p_patch, '{}');
begin
  perform public.ai_require_platform_admin();
  select * into v_before from public.ai_features where key = p_key;
  if v_before.key is null then
    raise exception 'not_found: AI feature';
  end if;
  if exists (select 1 from jsonb_object_keys(v_patch) k where k not in (
    'enabled', 'allowed_roles', 'allowed_tools', 'model_tier', 'max_input_chars', 'max_history_chars', 'max_output_tokens',
    'user_requests_per_minute', 'user_requests_per_day', 'school_requests_per_day', 'school_monthly_token_budget',
    'user_monthly_token_budget', 'request_token_reservation', 'medical_content_policy', 'allow_without_school',
    'store_content', 'content_retention_days', 'audit_retention_days', 'feedback_retention_days',
    'requires_human_approval')) then
    raise exception 'invalid_argument: unknown policy field';
  end if;
  -- An explicit null never means "unlimited" or "reset".
  if exists (select 1 from jsonb_each(v_patch) e where jsonb_typeof(e.value) = 'null') then
    raise exception 'invalid_argument: policy fields cannot be set to null';
  end if;

  update public.ai_features set
    enabled = coalesce((v_patch ->> 'enabled')::boolean, enabled),
    allowed_roles = case when v_patch ? 'allowed_roles'
                         then coalesce((select array_agg(x) from jsonb_array_elements_text(v_patch -> 'allowed_roles') x), '{}'::text[])
                         else allowed_roles end,
    allowed_tools = case when v_patch ? 'allowed_tools'
                         then coalesce((select array_agg(x) from jsonb_array_elements_text(v_patch -> 'allowed_tools') x), '{}'::text[])
                         else allowed_tools end,
    model_tier = coalesce(v_patch ->> 'model_tier', model_tier),
    max_input_chars = coalesce((v_patch ->> 'max_input_chars')::int, max_input_chars),
    max_history_chars = coalesce((v_patch ->> 'max_history_chars')::int, max_history_chars),
    max_output_tokens = coalesce((v_patch ->> 'max_output_tokens')::int, max_output_tokens),
    user_requests_per_minute = coalesce((v_patch ->> 'user_requests_per_minute')::int, user_requests_per_minute),
    user_requests_per_day = coalesce((v_patch ->> 'user_requests_per_day')::int, user_requests_per_day),
    school_requests_per_day = coalesce((v_patch ->> 'school_requests_per_day')::int, school_requests_per_day),
    school_monthly_token_budget = coalesce((v_patch ->> 'school_monthly_token_budget')::bigint, school_monthly_token_budget),
    user_monthly_token_budget = coalesce((v_patch ->> 'user_monthly_token_budget')::bigint, user_monthly_token_budget),
    request_token_reservation = coalesce((v_patch ->> 'request_token_reservation')::int, request_token_reservation),
    medical_content_policy = coalesce(v_patch ->> 'medical_content_policy', medical_content_policy),
    allow_without_school = coalesce((v_patch ->> 'allow_without_school')::boolean, allow_without_school),
    store_content = coalesce((v_patch ->> 'store_content')::boolean, store_content),
    content_retention_days = coalesce((v_patch ->> 'content_retention_days')::int, content_retention_days),
    audit_retention_days = coalesce((v_patch ->> 'audit_retention_days')::int, audit_retention_days),
    feedback_retention_days = coalesce((v_patch ->> 'feedback_retention_days')::int, feedback_retention_days),
    requires_human_approval = coalesce((v_patch ->> 'requires_human_approval')::boolean, requires_human_approval),
    updated_at = now(), updated_by = auth.uid()
  where key = p_key;

  perform public.write_audit_log(null, auth.uid(), 'ai_feature_updated', 'profiles', auth.uid(),
    jsonb_build_object('key', p_key, 'enabled', v_before.enabled), jsonb_build_object('key', p_key, 'patch', v_patch));
end;
$$;

-- Arguments left NULL keep the school's current value (a new row starts with
-- no features and the feature-level budget). p_clear_budget removes the
-- school's own budget so the feature-level budget applies; there is no way
-- to make a budget unlimited.
drop function public.ai_admin_set_school(uuid, boolean, text[], bigint);

create function public.ai_admin_set_school(
  p_school_id uuid,
  p_enabled boolean default null,
  p_enabled_features text[] default null,
  p_monthly_token_budget bigint default null,
  p_clear_budget boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_before public.ai_school_settings;
  v_after public.ai_school_settings;
begin
  perform public.ai_require_platform_admin();
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found: school';
  end if;
  if p_enabled_features is not null and exists (
    select 1 from unnest(p_enabled_features) k where k is null or not exists (select 1 from public.ai_features f where f.key = k)) then
    raise exception 'invalid_argument: unknown AI feature';
  end if;
  if p_monthly_token_budget is not null and p_monthly_token_budget <= 0 then
    raise exception 'invalid_argument: the budget must be positive';
  end if;
  if p_clear_budget and p_monthly_token_budget is not null then
    raise exception 'invalid_argument: pass a budget or clear it, not both';
  end if;

  select * into v_before from public.ai_school_settings where school_id = p_school_id;
  insert into public.ai_school_settings (school_id, enabled, enabled_features, monthly_token_budget, updated_by)
  values (p_school_id, coalesce(p_enabled, false), coalesce(p_enabled_features, '{}'), p_monthly_token_budget, auth.uid())
  on conflict (school_id) do update
    set enabled = coalesce(p_enabled, ai_school_settings.enabled),
        enabled_features = coalesce(p_enabled_features, ai_school_settings.enabled_features),
        monthly_token_budget = case when p_clear_budget then null
                                    else coalesce(p_monthly_token_budget, ai_school_settings.monthly_token_budget) end,
        updated_at = now(), updated_by = auth.uid()
  returning * into v_after;

  perform public.write_audit_log(p_school_id, auth.uid(), 'ai_school_settings_updated', 'schools', p_school_id,
    case when v_before.school_id is null then null
         else jsonb_build_object('enabled', v_before.enabled, 'features', v_before.enabled_features,
                                 'monthly_token_budget', v_before.monthly_token_budget) end,
    jsonb_build_object('enabled', v_after.enabled, 'features', v_after.enabled_features,
                       'monthly_token_budget', v_after.monthly_token_budget));
end;
$$;

-- ===========================================================================
-- 5. Grants
-- ===========================================================================

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ai\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

grant execute on function public.ai_caller_role() to authenticated;
grant execute on function public.ai_authorize_request(text, integer, text, integer) to authenticated;
grant execute on function public.ai_my_features() to authenticated;
grant execute on function public.ai_submit_feedback(uuid, text, text) to authenticated;
grant execute on function public.ai_usage_summary(date, date, uuid) to authenticated;
grant execute on function public.ai_admin_update_feature(text, jsonb) to authenticated;
grant execute on function public.ai_admin_set_school(uuid, boolean, text[], bigint, boolean) to authenticated;
grant execute on function public.ai_start_request(uuid) to service_role;
grant execute on function public.ai_record_tool_call(uuid, text, text, integer, integer, text) to service_role;
grant execute on function public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text, boolean) to service_role;
grant execute on function public.ai_store_exchange(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.ai_purge_expired() to service_role;
grant execute on function public.ai_recover_stale_requests() to service_role;
-- ai_lock is an internal helper; nobody outside these functions calls it.

-- ===========================================================================
-- 6. Schedules (pg_cron, when installed: hosted Supabase has it; the minimal
--    RLS test image does not). Jobs run as the cron owner and call functions
--    that need no JWT.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('funda-ai-recover-stale', '* * * * *', $job$select public.ai_recover_stale_requests()$job$);
    perform cron.schedule('funda-ai-retention', '20 2 * * *', $job$select public.ai_purge_expired()$job$);
  end if;
end;
$$;
