-- Funda AI pre-pilot hardening (20261009094000), audit of 2026-10-09.
-- Runs after zzzz_funda_ai.test.sql and reuses its helpers
-- (test_util.ai_authorize, test_util.ai_service, test_util.gr_call).
-- Concurrency itself is exercised against a real stack by
-- supabase/stack-tests/funda-ai.mjs (50 parallel requests); here we prove
-- the locks are taken and the reservation arithmetic is right.

do $$
declare
  v jsonb;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_n int;
  v_locks int;
  v_row public.ai_requests;
begin
  delete from public.ai_requests;
  update public.ai_features
     set enabled = true, user_requests_per_minute = 100, user_requests_per_day = 10000, school_requests_per_day = 100000,
         max_output_tokens = 1000, request_token_reservation = 1000, school_monthly_token_budget = 3000000, user_monthly_token_budget = 500000,
         max_input_chars = 4000, max_history_chars = 12000
   where key = 'copilot';
  update public.ai_school_settings set enabled = true, enabled_features = array['copilot'], monthly_token_budget = null
   where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- H1: the gate serialises per user and per school.
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_authorize_request(''copilot'', 10) || jsonb_build_object(''locks'', (select count(*) from pg_locks where locktype = ''advisory'' and pid = pg_backend_pid()))');
  v_locks := (v ->> 'locks')::int;
  call test_util.record('ai hardening: the gate holds at least two advisory locks (H1; serialisation itself is proven on the real stack)', v_locks >= 2, v::text);

  -- H1: the reservation happens at start and is single use.
  v_a := (v ->> 'request_id')::uuid;
  v := test_util.ai_service(format('select public.ai_start_request(%L)', v_a));
  select * into v_row from public.ai_requests where id = v_a;
  call test_util.record('ai hardening: starting a request reserves its tokens',
    (v ->> 'ok')::boolean and v_row.started_at is not null and v_row.reserved_tokens = 1000 and v_row.charged_tokens = 1000, v::text);
  v := test_util.ai_service(format('select public.ai_start_request(%L)', v_a));
  call test_util.record('ai hardening: a request can be started only once', v ->> 'reason' = 'invalid_request', v::text);

  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_b := (v ->> 'request_id')::uuid;
  update public.ai_requests set created_at = now() - interval '3 minutes' where id = v_b;
  v := test_util.ai_service(format('select public.ai_start_request(%L)', v_b));
  call test_util.record('ai hardening: an authorisation expires after 2 minutes unstarted', v ->> 'reason' = 'invalid_request', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('select public.ai_start_request(%L)', v_a));
  call test_util.record('ai hardening: users cannot start (reserve) requests themselves', v ->> 'error' like 'permission denied%', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('select to_jsonb(public.ai_lock(''user'', %L))', '11111111-1111-1111-1111-111111111111'));
  call test_util.record('ai hardening: the lock helper is not callable by users', v ->> 'error' like 'permission denied%', v::text);

  -- Settlement replaces the reservation with actual usage...
  perform test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''succeeded'', ''anthropic'', ''m'', ''school_copilot'', 2, 300, 50, null, 10, null, null))', v_a));
  select * into v_row from public.ai_requests where id = v_a;
  call test_util.record('ai hardening: completion settles the charge to actual tokens',
    v_row.charged_tokens = 350 and not v_row.usage_estimated, row_to_json(v_row)::text);

  -- ...unless usage is unknown (cut-off provider call): keep at least the reservation.
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_c := (v ->> 'request_id')::uuid;
  perform test_util.ai_service(format('select public.ai_start_request(%L)', v_c));
  perform test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''failed'', ''anthropic'', ''m'', ''school_copilot'', 2, 100, 0, null, 10, null, ''deadline_exceeded'', true))', v_c));
  select * into v_row from public.ai_requests where id = v_c;
  call test_util.record('ai hardening: unknown usage keeps the reservation charged and is marked estimated',
    v_row.charged_tokens = 1000 and v_row.usage_estimated, row_to_json(v_row)::text);

  -- A fresh, started request (v_b above expired unstarted; only started requests are settled, 20261009096000).
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_b := (v ->> 'request_id')::uuid;
  perform test_util.ai_service(format('select public.ai_start_request(%L)', v_b));
  perform test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''policy_blocked'', null, null, ''school_copilot'', 2, null, null, null, 5, array[''medical_topic''], ''medical_content_blocked''))', v_b));
  select count(*) into v_n from public.ai_requests where id = v_b and status = 'policy_blocked';
  call test_util.record('ai hardening: policy_blocked is a valid completion status', v_n = 1, v_n::text);
end $$;

-- H1: reservations, not just completed usage, count against budgets.
do $$
declare
  v jsonb;
  v1 uuid;
  v2 uuid;
  v3 uuid;
  s1 jsonb;
  s2 jsonb;
  s3 jsonb;
  v_status text;
begin
  delete from public.ai_requests;
  update public.ai_school_settings set monthly_token_budget = 2500 where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  -- Three authorisations pass the pre-check (nothing is reserved yet)...
  v1 := (test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') ->> 'request_id')::uuid;
  v2 := (test_util.ai_authorize('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') ->> 'request_id')::uuid;
  v3 := (test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') ->> 'request_id')::uuid;
  -- ...but only two reservations of 1000 fit in 2500.
  s1 := test_util.ai_service(format('select public.ai_start_request(%L)', v1));
  s2 := test_util.ai_service(format('select public.ai_start_request(%L)', v2));
  s3 := test_util.ai_service(format('select public.ai_start_request(%L)', v3));
  select status into v_status from public.ai_requests where id = v3;
  call test_util.record('ai hardening: concurrent-style starts cannot overspend the school budget',
    (s1 ->> 'ok')::boolean and (s2 ->> 'ok')::boolean and s3 ->> 'reason' = 'budget_exhausted' and v_status = 'blocked',
    s1::text || s2::text || s3::text);
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai hardening: in-flight reservations count in the gate''s budget check',
    v ->> 'reason' = 'budget_exhausted', v::text);

  update public.ai_school_settings set monthly_token_budget = null where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  update public.ai_features set user_monthly_token_budget = 1500 where key = 'copilot';
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai hardening: each user has a monthly budget too', v ->> 'reason' = 'budget_exhausted', v::text);
  update public.ai_features set user_monthly_token_budget = 500000 where key = 'copilot';
end $$;

-- H3: stale requests are closed; started ones stay charged, never-started ones are released.
do $$
declare
  v jsonb;
  v_started uuid;
  v_never uuid;
  v_fresh uuid;
  v_row public.ai_requests;
  v_n int;
begin
  delete from public.ai_requests;
  v_started := (test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') ->> 'request_id')::uuid;
  perform test_util.ai_service(format('select public.ai_start_request(%L)', v_started));
  update public.ai_requests set started_at = now() - interval '10 minutes', created_at = now() - interval '10 minutes' where id = v_started;
  v_never := (test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') ->> 'request_id')::uuid;
  update public.ai_requests set created_at = now() - interval '5 minutes' where id = v_never;
  v_fresh := (test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') ->> 'request_id')::uuid;
  perform test_util.ai_service(format('select public.ai_start_request(%L)', v_fresh));

  v := test_util.ai_service('select public.ai_recover_stale_requests()');
  call test_util.record('ai hardening: the sweep reports what it closed',
    (v ->> 'stale_started')::int = 1 and (v ->> 'never_started')::int = 1, v::text);
  select * into v_row from public.ai_requests where id = v_started;
  call test_util.record('ai hardening: a killed request is closed as failed with its reservation charged (estimated)',
    v_row.status = 'failed' and v_row.error_code = 'stale_request' and v_row.usage_estimated and v_row.charged_tokens = 1000
      and v_row.completed_at is not null, row_to_json(v_row)::text);
  select * into v_row from public.ai_requests where id = v_never;
  call test_util.record('ai hardening: a never-started request is closed with nothing charged',
    v_row.status = 'failed' and v_row.error_code = 'never_started' and v_row.charged_tokens = 0, row_to_json(v_row)::text);
  select count(*) into v_n from public.ai_requests where id = v_fresh and status = 'authorized';
  call test_util.record('ai hardening: a request still within its deadline is left alone', v_n = 1, v_n::text);

  perform test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''succeeded'', ''x'', ''x'', null, 2, 1, 1, null, 1, null, null))', v_started));
  select count(*) into v_n from public.ai_requests where id = v_started and status = 'failed' and charged_tokens = 1000;
  call test_util.record('ai hardening: a late completion cannot reopen a swept request', v_n = 1, v_n::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_recover_stale_requests()');
  call test_util.record('ai hardening: users cannot run the sweep', v ->> 'error' like 'permission denied%', v::text);
end $$;

-- M3: the message and the history have separate allowances.
do $$
declare
  v jsonb;
begin
  delete from public.ai_requests;
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_authorize_request(''copilot'', 20, null, 8000)');
  call test_util.record('ai hardening: a short follow-up with long history is allowed', (v ->> 'allowed')::boolean, v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_authorize_request(''copilot'', 20, null, 12001)');
  call test_util.record('ai hardening: history over its allowance is refused', v ->> 'reason' = 'input_too_large', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_authorize_request(''copilot'', 4001, null, 0)');
  call test_util.record('ai hardening: a message over its allowance is refused', v ->> 'reason' = 'input_too_large', v::text);
end $$;

-- L1: blocked attempts are recorded, but not without limit.
do $$
declare
  v jsonb;
  v_n int;
begin
  delete from public.ai_requests;
  for i in 1..30 loop
    v := test_util.ai_authorize('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  end loop;
  select count(*) into v_n from public.ai_requests where user_id = '33333333-3333-3333-3333-333333333333';
  call test_util.record('ai hardening: blocked attempts stop being recorded after 20 per minute', v_n = 20, v_n::text);
  call test_util.record('ai hardening: a throttled attempt is still refused with its reason',
    v ->> 'reason' = 'school_not_enabled' and not (v ? 'request_id'), v::text);
end $$;

-- M4: budgets are never unlimited; administration keeps what it is not given.
do $$
declare
  v jsonb;
  v_s public.ai_school_settings;
  v_n int;
  v_err text;
begin
  select count(*) into v_n from public.ai_features where school_monthly_token_budget is null;
  call test_util.record('ai hardening: no feature has an unlimited school budget', v_n = 0, v_n::text);
  begin
    update public.ai_features set school_monthly_token_budget = null where key = 'copilot';
    v_err := 'no error';
  exception when not_null_violation then
    v_err := 'not_null_violation';
  end;
  call test_util.record('ai hardening: a feature''s school budget cannot be removed', v_err = 'not_null_violation', v_err);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_update_feature(''copilot'', ''{"school_monthly_token_budget": null}''::jsonb))');
  call test_util.record('ai hardening: the admin RPC refuses null policy values', v ->> 'error' like 'invalid_argument%', v::text);

  -- A new school row starts with no features.
  delete from public.ai_school_settings where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', true))');
  select * into v_s from public.ai_school_settings where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  call test_util.record('ai hardening: enabling a school without a feature list grants no features',
    v ->> 'error' is null and v_s.enabled and v_s.enabled_features = '{}' and v_s.monthly_token_budget is null, row_to_json(v_s)::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', true, array[''copilot''], 5000))');
  -- Audit M4 scenario: disable, then re-enable, passing only the switch.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', false))');
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', true))');
  select * into v_s from public.ai_school_settings where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  call test_util.record('ai hardening: disable/re-enable keeps the school''s features and budget',
    v_s.enabled and v_s.enabled_features = array['copilot'] and v_s.monthly_token_budget = 5000, row_to_json(v_s)::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', p_clear_budget => true))');
  select * into v_s from public.ai_school_settings where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  call test_util.record('ai hardening: clearing a school budget falls back to the (finite) feature budget',
    v_s.monthly_token_budget is null and v_s.enabled and v_s.enabled_features = array['copilot'], row_to_json(v_s)::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', true, array[''no_such_feature'']))');
  call test_util.record('ai hardening: unknown feature keys are rejected', v ->> 'error' like 'invalid_argument%', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', true, null, 0))');
  call test_util.record('ai hardening: a zero or negative budget is rejected', v ->> 'error' like 'invalid_argument%', v::text);
  select count(*) into v_n from public.audit_log where action = 'ai_school_settings_updated' and school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  call test_util.record('ai hardening: school AI changes are audited with before and after', v_n >= 4, v_n::text);
  delete from public.ai_school_settings where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
end $$;

-- M5: retention expires requests, feedback and conversations; schedules exist where pg_cron does.
do $$
declare
  v jsonb;
  v_old uuid;
  v_recent uuid;
  v_open uuid;
  v_n int;
  v_cron boolean;
begin
  delete from public.ai_requests;
  update public.ai_features set audit_retention_days = 365, feedback_retention_days = 90 where key = 'copilot';
  insert into public.ai_requests (user_id, school_id, role, feature, status, created_at)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher', 'copilot', 'succeeded', now() - interval '400 days')
  returning id into v_old;
  insert into public.ai_requests (user_id, school_id, role, feature, status, created_at)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher', 'copilot', 'succeeded', now() - interval '100 days')
  returning id into v_recent;
  insert into public.ai_requests (user_id, school_id, role, feature, status, created_at)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher', 'copilot', 'authorized', now() - interval '400 days')
  returning id into v_open;
  insert into public.ai_tool_calls (request_id, tool, status) values (v_old, 'find_learners', 'ok');
  insert into public.ai_feedback (request_id, user_id, rating, comment, created_at) values
    (v_old, '11111111-1111-1111-1111-111111111111', 'problem', 'old', now() - interval '400 days'),
    (v_recent, '11111111-1111-1111-1111-111111111111', 'problem', 'past feedback retention', now() - interval '100 days');
  insert into public.ai_conversations (user_id, school_id, feature, expires_at)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'copilot', now() - interval '1 day');

  v := test_util.ai_service('select public.ai_purge_expired()');
  select count(*) into v_n from public.ai_requests where id = v_old;
  call test_util.record('ai hardening: requests past audit retention are deleted', v_n = 0, v::text);
  select count(*) into v_n from public.ai_tool_calls where request_id = v_old;
  call test_util.record('ai hardening: their tool-call rows go with them', v_n = 0, v_n::text);
  select count(*) into v_n from public.ai_feedback;
  call test_util.record('ai hardening: feedback past its own retention is deleted', v_n = 0 and (v ->> 'feedback')::int >= 1, v::text);
  select count(*) into v_n from public.ai_requests where id = v_recent;
  call test_util.record('ai hardening: requests inside retention are kept', v_n = 1, v_n::text);
  select count(*) into v_n from public.ai_requests where id = v_open;
  call test_util.record('ai hardening: an unsettled request is never purged (the sweep closes it first)', v_n = 1, v_n::text);
  call test_util.record('ai hardening: expired conversations are deleted', (v ->> 'conversations')::int = 1, v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_purge_expired()');
  call test_util.record('ai hardening: users cannot run the purge', v ->> 'error' like 'permission denied%', v::text);

  v_cron := exists (select 1 from pg_extension where extname = 'pg_cron');
  if v_cron then
    execute 'select count(*) from cron.job where jobname in (''funda-ai-recover-stale'', ''funda-ai-retention'')' into v_n;
    call test_util.record('ai hardening: the sweep and purge are scheduled with pg_cron', v_n = 2, v_n::text);
  else
    call test_util.record('ai hardening: without pg_cron the migration applies and schedules nothing (verified on the real stack)', true,
      'pg_cron not installed in this image');
  end if;
  delete from public.ai_requests;
end $$;

-- ---------------------------------------------------------------------------
-- Pre-merge fixes (20261009095000): independent review of 2026-10-09
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_err text;
  v_n int;
  v_row uuid;
  v_ok boolean;
begin
  -- #4 a reservation smaller than one maximal output is refused.
  begin
    update public.ai_features set request_token_reservation = 500, max_output_tokens = 1000 where key = 'copilot';
    v_err := 'no error';
  exception when check_violation then
    v_err := 'check_violation';
  end;
  call test_util.record('ai pre-merge: a reservation must cover the largest single output (#4)', v_err = 'check_violation', v_err);

  -- #10 the budget month starts at midnight in South Africa.
  v_ok := public.ai_month_start() = (date_trunc('month', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg')
          and extract(day from public.ai_month_start() at time zone 'Africa/Johannesburg') = 1
          and (public.ai_month_start() at time zone 'Africa/Johannesburg')::time = '00:00';
  call test_util.record('ai pre-merge: budget months follow Africa/Johannesburg (#10)', v_ok, public.ai_month_start()::text);

  -- ai_start_request returns the reservation the gateway caps output with.
  delete from public.ai_requests;
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v := test_util.ai_service(format('select public.ai_start_request(%L)', v ->> 'request_id'));
  call test_util.record('ai pre-merge: the started policy carries the reservation (#4)',
    (v -> 'policy' ->> 'request_token_reservation')::int = 1000, v::text);

  -- #5 retention never deletes rows from the current budget month.
  alter table public.ai_features drop constraint ai_features_audit_retention_days_check;
  -- Retention 0 days: every row is past retention, so only the month guard can keep one.
  update public.ai_features set audit_retention_days = 0 where key = 'copilot';
  delete from public.ai_requests;
  insert into public.ai_requests (user_id, school_id, role, feature, status, created_at, charged_tokens)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher', 'copilot', 'succeeded',
          public.ai_month_start(), 900)
  returning id into v_row;
  perform test_util.ai_service('select public.ai_purge_expired()');
  select count(*) into v_n from public.ai_requests where id = v_row;
  call test_util.record('ai pre-merge: retention keeps this month''s rows so budgets stay correct (#5)', v_n = 1, v_n::text);
  insert into public.ai_requests (user_id, school_id, role, feature, status, created_at)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher', 'copilot', 'succeeded',
          public.ai_month_start() - interval '2 days')
  returning id into v_row;
  perform test_util.ai_service('select public.ai_purge_expired()');
  select count(*) into v_n from public.ai_requests where id = v_row;
  call test_util.record('ai pre-merge: rows from earlier months past retention are still purged (#5)', v_n = 0, v_n::text);
  update public.ai_features set audit_retention_days = 365 where key = 'copilot';
  alter table public.ai_features add constraint ai_features_audit_retention_days_check check (audit_retention_days between 30 and 3650);

  -- #6 usage summary: charged tokens; aal2 for platform administrators.
  delete from public.ai_requests;
  insert into public.ai_requests (user_id, school_id, role, feature, status, input_tokens, output_tokens, charged_tokens, usage_estimated)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher', 'copilot', 'failed', 10, 0, 1000, true),
         ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher', 'copilot', 'policy_blocked', null, null, 0, false);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.ai_usage_summary(current_date - 1, current_date)', 'aal1');
  call test_util.record('ai pre-merge: platform-wide AI usage needs an aal2 session (#6)', v ->> 'error' like 'mfa_required%', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.ai_usage_summary(current_date - 1, current_date)');
  call test_util.record('ai pre-merge: usage reports charged tokens, estimates and policy blocks (#6)',
    (v -> 0 ->> 'charged_tokens')::int = 1000 and (v -> 0 ->> 'estimated_usage_requests')::int = 1
      and (v -> 0 ->> 'policy_blocked')::int = 1, v::text);
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_usage_summary(current_date - 1, current_date)', 'aal1');
  call test_util.record('ai pre-merge: a school owner still sees their own school''s usage (unchanged)', jsonb_array_length(v) >= 1, v::text);

  -- #6 platform-administrator reads of other users' AI rows need aal2; own rows do not.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(count(*)) from public.ai_requests', 'aal1');
  call test_util.record('ai pre-merge: an aal1 platform administrator reads no other users'' AI requests (#6)', v::text = '0', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(count(*)) from public.ai_requests');
  call test_util.record('ai pre-merge: an aal2 platform administrator can audit AI requests', (v #>> '{}')::int = 2, v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(count(*)) from public.ai_features', 'aal1');
  call test_util.record('ai pre-merge: an aal1 platform administrator cannot read AI policy (#6)', v::text = '0', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.ai_requests', 'aal1');
  call test_util.record('ai pre-merge: users still read their own AI requests without aal2', (v #>> '{}')::int = 2, v::text);
  delete from public.ai_requests;
end $$;
