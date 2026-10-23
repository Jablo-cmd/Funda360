-- Regression suite for 20261023090000_payment_webhook_hardening.sql
-- (forensic audit 2026-10-23, S-1 and S-2). Runs after
-- payment_gateway.test.sql, which leaves School A with an enabled PayFast
-- test gateway and the PayGw guardian/learner fixtures.

-- ---------------------------------------------------------------------------
-- 1. S-1: a Netcash gateway cannot be enabled.
do $$
declare v_error text;
begin
  perform set_config('request.jwt.claims',
    test_util.jwt_claims('17171717-1717-1717-1717-171717171717', 'finance_manager', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  begin
    update public.payment_gateway_configs
      set provider = 'netcash', enabled = true, merchant_config = '{"service_key":"k"}'
      where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    call test_util.record('S-1: an enabled Netcash gateway is refused', false, 'update succeeded');
  exception when check_violation then
    get stacked diagnostics v_error = message_text;
    call test_util.record('S-1: an enabled Netcash gateway is refused', true, v_error);
  end;
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 2. S-1: settle_payment_intent never settles a Netcash callback, even one
-- the Edge Function passed as verified.
do $$
declare
  v_intent public.payment_intents;
  v_result jsonb;
  v_status text;
  v_logged int;
begin
  perform set_config('request.jwt.claims',
    test_util.jwt_claims('f2220000-0000-0000-0000-0000000000a1', 'guardian', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  select * into v_intent from public.create_payment_intent('f2220000-0000-0000-0000-0000000000e1', 120, null, 'https://x/r', 'https://x/c');
  execute 'reset role';

  execute 'set local role service_role';
  select public.settle_payment_intent('netcash', 'test', 'nc-trace-1', v_intent.reference, 'nc-1', 120, 'succeeded', true, '{}'::jsonb) into v_result;
  execute 'reset role';

  select status into v_status from public.payment_intents where id = v_intent.id;
  select count(*) into v_logged from public.payment_webhook_events
    where provider = 'netcash' and provider_event_id = 'nc-trace-1' and not signature_valid and processing_error = 'provider_not_verifiable';
  call test_util.record('S-1: a Netcash callback does not settle the intent',
    v_status = 'created' and v_result ->> 'result' = 'signature_invalid', v_status || ' ' || v_result::text);
  call test_util.record('S-1: the refused Netcash callback is logged as unverifiable', v_logged = 1, 'rows: ' || v_logged);
end $$;

-- ---------------------------------------------------------------------------
-- 3. S-2: a forged callback that claims a genuine event id first no longer
-- blocks the genuine callback; repeated forgeries are all logged; a verified
-- duplicate is still ignored.
do $$
declare
  v_ref text;
  v_forged jsonb;
  v_forged_again jsonb;
  v_genuine jsonb;
  v_dup jsonb;
  v_status text;
  v_unverified int;
  v_verified int;
begin
  select reference into v_ref from public.payment_intents
    where learner_id = 'f2220000-0000-0000-0000-0000000000e1' and amount = 120 and status = 'created'
    order by created_at desc limit 1;

  execute 'set local role service_role';
  select public.settle_payment_intent('payfast', 'test', 'pf-preempt-1', v_ref, null, 120, 'failed', false, '{"forged":true}'::jsonb) into v_forged;
  select public.settle_payment_intent('payfast', 'test', 'pf-preempt-1', v_ref, null, 120, 'failed', false, '{"forged":true}'::jsonb) into v_forged_again;
  select public.settle_payment_intent('payfast', 'test', 'pf-preempt-1', v_ref, 'pf-preempt-1', 120, 'succeeded', true, '{"pf":"ok"}'::jsonb) into v_genuine;
  select public.settle_payment_intent('payfast', 'test', 'pf-preempt-1', v_ref, 'pf-preempt-1', 120, 'succeeded', true, '{"pf":"ok"}'::jsonb) into v_dup;
  execute 'reset role';

  select status into v_status from public.payment_intents where reference = v_ref;
  select count(*) filter (where not signature_valid), count(*) filter (where signature_valid)
    into v_unverified, v_verified
    from public.payment_webhook_events where provider = 'payfast' and provider_event_id = 'pf-preempt-1';

  call test_util.record('S-2: forged callbacks are refused',
    v_forged ->> 'result' = 'signature_invalid' and v_forged_again ->> 'result' = 'signature_invalid', v_forged::text);
  call test_util.record('S-2: the genuine callback settles after a forged one used its event id',
    v_genuine ->> 'result' = 'succeeded' and v_status = 'succeeded', v_genuine::text);
  call test_util.record('S-2: a verified duplicate is still ignored', v_dup ->> 'result' = 'duplicate_ignored', v_dup::text);
  call test_util.record('S-2: both forgeries and one verified event are recorded',
    v_unverified = 2 and v_verified = 1, 'unverified: ' || v_unverified || ' verified: ' || v_verified);
end $$;
