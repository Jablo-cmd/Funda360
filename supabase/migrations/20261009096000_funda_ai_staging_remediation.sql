-- Funda AI staging remediation (2026-10-09). Forward-only; no data is
-- changed or removed.
--
-- 1. ai_authorize_request: at most 2 authorised-but-unstarted requests per
--    user (new reason "too_many_pending"); requests that never started no
--    longer count towards the SCHOOL's daily quota, so direct RPC calls by
--    a few users cannot use up AI for the whole school. (They still count
--    towards the caller's own limits.)
-- 2. ai_complete_request: settles only requests that were started (so the
--    reservation was taken), and charges p_unseen_tokens: the gateway's
--    estimate for failed attempts that may have been billed without
--    reporting usage.
-- 3. ai_school_settings: the school branch of the read policy no longer
--    admits platform administrators (can_manage_academic() is true for any
--    platform admin; a platform admin with a tenant could read that school's
--    row at aal1). Platform admins read it through the aal2 branch only.
-- 4. audit_log: platform administrators read AI configuration history
--    (actions "ai_%") only in an aal2 session. Everything else in the audit
--    policy is unchanged (the current policy is wrapped, not rewritten).

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

  -- Requests authorised but never started (a direct RPC call, or a client
  -- that gave up) may not pile up: at most 2 open per user at a time.
  if v_reason is null then
    select count(*) into v_count from public.ai_requests
    where user_id = v_uid and status = 'authorized' and started_at is null and created_at > now() - interval '2 minutes';
    if v_count >= 2 then
      v_reason := 'too_many_pending';
    end if;
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
    -- Requests that never reached the gateway do not use up the school's quota.
    where school_id = v_school and created_at > now() - interval '1 day' and status <> 'blocked'
      and coalesce(error_code, '') <> 'never_started';
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

-- ---------------------------------------------------------------------------
drop function public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text, boolean);

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
  p_usage_unknown boolean default false,
  p_unseen_tokens bigint default 0
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_seen bigint := greatest(coalesce(p_input_tokens, 0), 0) + greatest(coalesce(p_output_tokens, 0), 0);
  -- Bounded, so a faulty caller cannot charge an absurd amount (10M tokens).
  v_unseen bigint := least(greatest(coalesce(p_unseen_tokens, 0), 0), 10 * 1000000::bigint);
  v_estimated boolean := coalesce(p_usage_unknown, false) or coalesce(p_unseen_tokens, 0) > 0;
begin
  if p_status not in ('succeeded', 'failed', 'safety_escalated', 'policy_blocked') then
    raise exception 'invalid_argument: unknown completion status';
  end if;
  update public.ai_requests
     set status = p_status, provider = left(p_provider, 40), model = left(p_model, 80),
         prompt_id = coalesce(left(p_prompt_id, 60), prompt_id), prompt_version = p_prompt_version,
         input_tokens = p_input_tokens, output_tokens = p_output_tokens, estimated_cost_micros = p_estimated_cost_micros,
         duration_ms = p_duration_ms, safety_flags = coalesce(p_safety_flags, '{}'), error_code = left(p_error_code, 80),
         charged_tokens = case when coalesce(p_usage_unknown, false) then greatest(v_seen + v_unseen, reserved_tokens)
                               else v_seen + v_unseen end,
         usage_estimated = v_estimated,
         completed_at = now()
   where id = p_request_id and status = 'authorized' and started_at is not null;
end;
$$;

revoke execute on function public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text, boolean, bigint)
  from public, anon, authenticated;
grant execute on function public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text, boolean, bigint)
  to service_role;

-- ---------------------------------------------------------------------------
drop policy ai_school_settings_select on public.ai_school_settings;
create policy ai_school_settings_select on public.ai_school_settings
  for select to authenticated
  using (((select public.is_platform_admin()) and (select public.session_is_aal2()))
         or (school_id = (select public.current_tenant_id())
             and (select public.can_manage_academic((select public.current_tenant_id())))
             and not (select public.is_platform_admin())));

-- ---------------------------------------------------------------------------
do $$
declare
  v_qual text;
  v_roles text;
begin
  select qual, array_to_string(roles, ', ') into v_qual, v_roles
    from pg_policies where schemaname = 'public' and tablename = 'audit_log' and policyname = 'audit_log_select' and cmd = 'SELECT';
  if v_qual is null then
    raise exception 'audit_log_select policy not found: refusing to guess its definition';
  end if;
  execute 'drop policy audit_log_select on public.audit_log';
  execute format(
    'create policy audit_log_select on public.audit_log for select to %s using ((%s) and (action not like %L or not (select public.is_platform_admin()) or (select public.session_is_aal2())))',
    v_roles, v_qual, 'ai\_%');
end;
$$;

select public.rls_optimize_policies();
