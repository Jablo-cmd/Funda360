-- Funda AI staging remediation (20261009096000): authorisation and
-- accounting regressions. Users: 1111 teacher and 2222 school owner of
-- school aaaa, 4444 platform administrator (no tenant).

do $$
declare
  v jsonb;
  v_a uuid;
  v_b uuid;
  v_n int;
  v_charged bigint;
  v_status text;
  v_estimated boolean;
begin
  update public.ai_features
     set enabled = true, user_requests_per_minute = 100, user_requests_per_day = 10000, school_requests_per_day = 100000,
         max_output_tokens = 1000, request_token_reservation = 1000, school_monthly_token_budget = 3000000, user_monthly_token_budget = 500000
   where key = 'copilot';
  update public.ai_school_settings set enabled = true, enabled_features = array['copilot'], monthly_token_budget = null
   where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  delete from public.ai_requests;

  -- At most 2 authorised-but-unstarted requests per user.
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_a := (v ->> 'request_id')::uuid;
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_b := (v ->> 'request_id')::uuid;
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai remediation: a third unstarted request is refused (too_many_pending)',
    v ->> 'allowed' = 'false' and v ->> 'reason' = 'too_many_pending', v::text);
  -- Starting one frees a slot.
  v := test_util.ai_service(format('select public.ai_start_request(%L)', v_a));
  call test_util.record('ai remediation: the first request starts', (v ->> 'ok')::boolean, v::text);
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai remediation: a started request no longer counts as pending', v ->> 'allowed' = 'true', v::text);

  -- Completing a request that was never started changes nothing.
  v := test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''succeeded'', ''x'', ''m'', ''p'', 1, 100, 50, 0, 1, ''{}'', null, false, 0))', v_b));
  select status, charged_tokens into v_status, v_charged from public.ai_requests where id = v_b;
  call test_util.record('ai remediation: a never-started request cannot be settled (the reservation was never taken)',
    v_status = 'authorized' and v_charged = 0 and not (v ? 'error'), v_status || ' ' || v_charged || ' ' || v::text);

  -- Unseen (possibly billed) attempts are charged on top of reported usage.
  v := test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''succeeded'', ''x'', ''m'', ''p'', 1, 100, 50, 0, 1, ''{}'', null, false, 500))', v_a));
  select charged_tokens, usage_estimated into v_charged, v_estimated from public.ai_requests where id = v_a;
  call test_util.record('ai remediation: unseen attempt tokens are charged and marked estimated',
    v_charged = 650 and v_estimated, v_charged || ' ' || v_estimated || ' ' || coalesce(v::text, ''));

  -- Unknown final usage still keeps at least the reservation.
  delete from public.ai_requests;
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_a := (v ->> 'request_id')::uuid;
  perform test_util.ai_service(format('select public.ai_start_request(%L)', v_a));
  perform test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''failed'', ''x'', ''m'', ''p'', 1, 10, 0, 0, 1, ''{}'', ''provider_timeout'', true, 200))', v_a));
  select charged_tokens into v_charged from public.ai_requests where id = v_a;
  call test_util.record('ai remediation: unknown usage keeps the reservation (1000), not just seen + unseen (210)', v_charged = 1000, v_charged::text);

  -- Grants: the new signature is service-only; the old one is gone.
  call test_util.record('ai remediation: users cannot settle requests (new signature is service-only)',
    not has_function_privilege('authenticated',
      'public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text, boolean, bigint)', 'execute')
    and not has_function_privilege('anon',
      'public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text, boolean, bigint)', 'execute'),
    'grants');
  select count(*) into v_n from pg_proc where proname = 'ai_complete_request' and pronamespace = 'public'::regnamespace;
  call test_util.record('ai remediation: only one ai_complete_request signature exists', v_n = 1, v_n::text);

  -- Requests that never reached the gateway do not use up the school's quota.
  delete from public.ai_requests;
  update public.ai_features set school_requests_per_day = 3 where key = 'copilot';
  insert into public.ai_requests (user_id, school_id, role, feature, status, error_code, charged_tokens)
  select '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'school_owner', 'copilot', 'failed', 'never_started', 0
  from generate_series(1, 5);
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai remediation: never-started requests by others do not exhaust the school quota', v ->> 'allowed' = 'true', v::text);
  insert into public.ai_requests (user_id, school_id, role, feature, status, charged_tokens)
  select '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'school_owner', 'copilot', 'succeeded', 10
  from generate_series(1, 3);
  delete from public.ai_requests where user_id = '11111111-1111-1111-1111-111111111111';
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai remediation: real requests still count towards the school quota', v ->> 'reason' = 'rate_limited', v::text);
  update public.ai_features set school_requests_per_day = 100000 where key = 'copilot';
  delete from public.ai_requests;
end $$;

-- A platform administrator whose profile has a tenant reads that school's AI
-- settings only in an aal2 session; the school's own leaders are unchanged.
do $$
declare
  v jsonb;
begin
  perform set_config('session_replication_role', 'replica', true); -- bypass the tenant-change guard for the fixture
  update public.profiles set tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' where id = '44444444-4444-4444-4444-444444444444';
  perform set_config('session_replication_role', 'origin', true);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.ai_school_settings', 'aal1');
  call test_util.record('ai remediation: an aal1 platform admin with a tenant cannot read that school''s AI settings', v::text = '0', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.ai_school_settings');
  call test_util.record('ai remediation: an aal2 platform admin reads AI settings', (v #>> '{}')::int >= 1, v::text);
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.ai_school_settings', 'aal1');
  call test_util.record('ai remediation: the school owner still reads their own school''s AI settings', v::text = '1', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.ai_school_settings', 'aal1');
  call test_util.record('ai remediation: a teacher still cannot read AI settings', v::text = '0', v::text);

  perform set_config('session_replication_role', 'replica', true);
  update public.profiles set tenant_id = null where id = '44444444-4444-4444-4444-444444444444';
  perform set_config('session_replication_role', 'origin', true);
end $$;

-- AI configuration history in the audit log needs aal2 for platform
-- administrators; other audit rows are unchanged.
do $$
declare
  v jsonb;
begin
  delete from public.audit_log where action in ('ai_feature_updated', 'ai_school_settings_updated', 'remediation_probe');
  perform public.write_audit_log(null, '44444444-4444-4444-4444-444444444444', 'ai_feature_updated', 'profiles', '44444444-4444-4444-4444-444444444444');
  perform public.write_audit_log(null, '44444444-4444-4444-4444-444444444444', 'remediation_probe', 'profiles', '44444444-4444-4444-4444-444444444444');
  perform public.write_audit_log('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'ai_school_settings_updated',
    'schools', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(array_agg(action order by action)) from public.audit_log where action in (''ai_feature_updated'', ''ai_school_settings_updated'', ''remediation_probe'')', 'aal1');
  call test_util.record('ai remediation: an aal1 platform admin reads other audit rows but no AI configuration history',
    v = '["remediation_probe"]'::jsonb, v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(array_agg(action order by action)) from public.audit_log where action in (''ai_feature_updated'', ''ai_school_settings_updated'', ''remediation_probe'')');
  call test_util.record('ai remediation: an aal2 platform admin reads AI configuration history',
    v = '["ai_feature_updated", "ai_school_settings_updated", "remediation_probe"]'::jsonb, v::text);
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(array_agg(action order by action)) from public.audit_log where action in (''ai_feature_updated'', ''ai_school_settings_updated'', ''remediation_probe'')', 'aal1');
  call test_util.record('ai remediation: a school owner still reads their own school''s audit trail (unchanged)',
    v = '["ai_school_settings_updated"]'::jsonb, v::text);
  delete from public.audit_log where action in ('ai_feature_updated', 'ai_school_settings_updated', 'remediation_probe');
end $$;
