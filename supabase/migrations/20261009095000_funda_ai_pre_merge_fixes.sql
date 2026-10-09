-- Funda AI pre-merge fixes (independent review of 2026-10-09).
--
--   #4  A request's reservation must cover at least its maximum output
--       (CHECK); the gateway also caps each turn's output by what is left
--       of the reservation (request_token_reservation is now in the policy).
--   #5  The purge never deletes rows from the current budget month, so
--       budgets cannot be under-counted by retention.
--   #6  ai_usage_summary reports what budgets actually charge
--       (charged_tokens, estimated usage, policy_blocked) and requires an
--       aal2 session for the all-schools (platform administrator) path; the
--       platform-administrator read paths of the AI tables require aal2 too.
--   #10 Budget months follow South African time (Africa/Johannesburg).
-- Forward-only; changes 20261009094000_funda_ai_hardening without editing it.

-- ===========================================================================
-- 1. Budget month in South African time
-- ===========================================================================

create function public.ai_month_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('month', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg'
$$;

comment on function public.ai_month_start() is
  'Start of the current budget month (Africa/Johannesburg). Internal helper for the AI budget functions.';

-- ===========================================================================
-- 2. Reservation must cover the largest single output
-- ===========================================================================

alter table public.ai_features
  add constraint ai_features_reservation_covers_output check (request_token_reservation >= max_output_tokens);

-- ===========================================================================
-- 3. Gate and start: SA budget month; start returns the reservation
--    (bodies otherwise identical to 20261009094000)
-- ===========================================================================

create or replace function public.ai_authorize_request(
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
    where user_id = v_uid and created_at >= public.ai_month_start();
    if v_used + v_feature.request_token_reservation > v_feature.user_monthly_token_budget then
      v_reason := 'budget_exhausted';
    end if;
  end if;
  if v_reason is null and v_school is not null then
    v_budget := coalesce(v_settings.monthly_token_budget, v_feature.school_monthly_token_budget);
    select coalesce(sum(charged_tokens), 0) into v_used from public.ai_requests
    where school_id = v_school and created_at >= public.ai_month_start();
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

create or replace function public.ai_start_request(p_request_id uuid)
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
  where user_id = v_req.user_id and created_at >= public.ai_month_start();
  if v_used + v_feature.request_token_reservation > v_feature.user_monthly_token_budget then
    v_reason := 'budget_exhausted';
  end if;
  if v_reason is null and v_req.school_id is not null then
    select * into v_settings from public.ai_school_settings where school_id = v_req.school_id;
    select coalesce(sum(charged_tokens), 0) into v_used from public.ai_requests
    where school_id = v_req.school_id and created_at >= public.ai_month_start();
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
      'request_token_reservation', v_feature.request_token_reservation,
      'medical_content_policy', v_feature.medical_content_policy,
      'store_content', v_feature.store_content,
      'content_retention_days', v_feature.content_retention_days,
      'requires_human_approval', v_feature.requires_human_approval
    )
  );
end;
$$;

-- ===========================================================================
-- 4. Retention never touches the current budget month
-- ===========================================================================

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
  v_month timestamptz := public.ai_month_start();
begin
  delete from public.ai_conversations where expires_at < now();
  get diagnostics v_conv = row_count;
  delete from public.ai_feedback fb using public.ai_requests r, public.ai_features f
  where r.id = fb.request_id and f.key = r.feature
    and fb.created_at < now() - make_interval(days => f.feedback_retention_days);
  get diagnostics v_feedback = row_count;
  delete from public.ai_requests r using public.ai_features f
  where f.key = r.feature and r.created_at < now() - make_interval(days => f.audit_retention_days)
    and r.created_at < v_month
    and r.status <> 'authorized';
  get diagnostics v_req = row_count;
  return jsonb_build_object('conversations', v_conv, 'feedback', v_feedback, 'requests', v_req);
end;
$$;

-- ===========================================================================
-- 5. Usage summary: charged tokens; aal2 for the all-schools path
-- ===========================================================================

create or replace function public.ai_usage_summary(p_from date, p_to date, p_school_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_school uuid := p_school_id;
begin
  if public.is_platform_admin() then
    perform public.ai_require_platform_admin(); -- platform administrators need an aal2 session
  else
    if public.current_tenant_id() is null or not public.can_manage_academic(public.current_tenant_id()) then
      raise exception 'insufficient_privilege: AI usage is visible to school leadership and platform administrators';
    end if;
    if v_school is not null and v_school <> public.current_tenant_id() then
      raise exception 'insufficient_privilege: this school is outside your scope';
    end if;
    v_school := public.current_tenant_id();
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_argument: choose a period of at most one year';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'school_id', school_id, 'feature', feature, 'provider', provider, 'model', model,
      'requests', requests, 'succeeded', succeeded, 'failed', failed, 'blocked', blocked,
      'safety_escalated', safety_escalated, 'policy_blocked', policy_blocked,
      'input_tokens', input_tokens, 'output_tokens', output_tokens,
      'charged_tokens', charged_tokens, 'estimated_usage_requests', estimated_usage_requests,
      'estimated_cost_micros', estimated_cost_micros) order by school_id, feature, model)
    from (
      select school_id, feature, provider, model,
             count(*) as requests,
             count(*) filter (where status = 'succeeded') as succeeded,
             count(*) filter (where status = 'failed') as failed,
             count(*) filter (where status = 'blocked') as blocked,
             count(*) filter (where status = 'safety_escalated') as safety_escalated,
             count(*) filter (where status = 'policy_blocked') as policy_blocked,
             coalesce(sum(input_tokens), 0) as input_tokens,
             coalesce(sum(output_tokens), 0) as output_tokens,
             coalesce(sum(charged_tokens), 0) as charged_tokens,
             count(*) filter (where usage_estimated) as estimated_usage_requests,
             sum(estimated_cost_micros) as estimated_cost_micros
      from public.ai_requests
      where created_at >= p_from and created_at < p_to + 1
        and (v_school is null or school_id = v_school)
      group by school_id, feature, provider, model
    ) t
  ), '[]'::jsonb);
end;
$$;

-- ===========================================================================
-- 6. Platform-administrator reads of AI tables need an aal2 session
--    (users' own rows and school leaders' own-school settings are unchanged)
-- ===========================================================================

drop policy ai_features_select on public.ai_features;
create policy ai_features_select on public.ai_features
  for select to authenticated using ((select public.is_platform_admin()) and (select public.session_is_aal2()));

drop policy ai_school_settings_select on public.ai_school_settings;
create policy ai_school_settings_select on public.ai_school_settings
  for select to authenticated
  using (((select public.is_platform_admin()) and (select public.session_is_aal2()))
         or (school_id = (select public.current_tenant_id()) and (select public.can_manage_academic((select public.current_tenant_id())))));

drop policy ai_requests_select on public.ai_requests;
create policy ai_requests_select on public.ai_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or ((select public.is_platform_admin()) and (select public.session_is_aal2())));

drop policy ai_tool_calls_select on public.ai_tool_calls;
create policy ai_tool_calls_select on public.ai_tool_calls
  for select to authenticated
  using (((select public.is_platform_admin()) and (select public.session_is_aal2()))
         or exists (select 1 from public.ai_requests r where r.id = ai_tool_calls.request_id and r.user_id = (select auth.uid())));

drop policy ai_feedback_select on public.ai_feedback;
create policy ai_feedback_select on public.ai_feedback
  for select to authenticated
  using (user_id = (select auth.uid()) or ((select public.is_platform_admin()) and (select public.session_is_aal2())));

-- ===========================================================================
-- 7. Grants (CREATE OR REPLACE keeps existing grants; the new helper is internal)
-- ===========================================================================

revoke execute on function public.ai_month_start() from public, anon, authenticated;

select public.rls_optimize_policies();
