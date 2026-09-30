-- Regression suite for 20260930090000_revoke_public_worker_execute.sql.
-- The two un-gated SECURITY DEFINER workers must not be callable by anon or
-- authenticated; the gated trigger_* wrapper must still work for an
-- authorized finance role and still reject everyone else.

do $$
declare
  v_fn text;
  v_role text;
begin
  foreach v_fn in array array['public.run_fee_overdue_reminders(uuid)', 'public.run_document_expiry_alerts(uuid)'] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      call test_util.record(
        v_role || ' has no EXECUTE on ' || v_fn,
        not has_function_privilege(v_role, v_fn, 'execute'),
        ''
      );
    end loop;
  end loop;
end $$;

-- anon calling the worker directly is rejected.
do $$
declare v_error text;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    perform public.run_fee_overdue_reminders('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    call test_util.record('anon cannot trigger another school''s fee reminders', false, 'call succeeded unexpectedly');
  exception when insufficient_privilege then
    get stacked diagnostics v_error = message_text;
    call test_util.record('anon cannot trigger another school''s fee reminders', true, 'correctly rejected: ' || v_error);
  end;
  execute 'reset role';
end $$;

-- A School A finance manager can still use the gated wrapper for School A…
do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims', test_util.jwt_claims('17171717-1717-1717-1717-171717171717', 'finance_manager', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  v_count := public.trigger_fee_overdue_reminders('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('finance_manager can still send own-school reminders via trigger_fee_overdue_reminders', v_count >= 0, 'sent=' || v_count);
  execute 'reset role';
end $$;

-- …but not for School B.
do $$
declare v_error text;
begin
  perform set_config('request.jwt.claims', test_util.jwt_claims('17171717-1717-1717-1717-171717171717', 'finance_manager', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  begin
    perform public.trigger_fee_overdue_reminders('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    call test_util.record('finance_manager cannot send another school''s reminders', false, 'call succeeded unexpectedly');
  exception when others then
    get stacked diagnostics v_error = message_text;
    call test_util.record('finance_manager cannot send another school''s reminders', v_error like 'insufficient_privilege%', v_error);
  end;
  execute 'reset role';
end $$;
