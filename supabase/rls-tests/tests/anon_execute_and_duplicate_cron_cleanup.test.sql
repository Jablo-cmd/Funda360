-- Regression suite for 20261008090000_anon_execute_and_duplicate_cron_cleanup.sql.
-- anon must not hold EXECUTE on any SECURITY DEFINER function in public, no
-- caller role needs EXECUTE on a trigger function, and triggers must still
-- fire for an ordinary signed-in writer.

do $$
declare
  v_anon int;
  v_names text;
begin
  select count(*), string_agg(p.proname, ', ')
    into v_anon, v_names
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute');
  call test_util.record('anon has EXECUTE on no SECURITY DEFINER function', v_anon = 0, coalesce(v_names, 'none'));
end $$;

do $$
declare
  v_count int;
  v_names text;
begin
  select count(*), string_agg(p.proname, ', ')
    into v_count, v_names
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype = 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute');
  call test_util.record('authenticated has EXECUTE on no SECURITY DEFINER trigger function', v_count = 0, coalesce(v_names, 'none'));
end $$;

do $$
declare
  v_fee boolean := has_function_privilege('authenticated', 'public.trigger_fee_overdue_reminders(uuid)', 'execute');
  v_doc boolean := has_function_privilege('authenticated', 'public.trigger_document_expiry_alerts(uuid)', 'execute');
begin
  call test_util.record('authenticated keeps EXECUTE on trigger_fee_overdue_reminders', v_fee, '');
  call test_util.record('authenticated keeps EXECUTE on trigger_document_expiry_alerts', v_doc, '');
end $$;

-- Triggers still fire after the revoke: a School A vice principal recording
-- a behaviour incident goes through behaviour_incidents_validate_tenant()
-- and the audit trigger. The insert is rolled back so later suites see the
-- fixtures unchanged.
do $$
declare
  v_error text;
begin
  perform set_config('request.jwt.claims',
    test_util.jwt_claims('14141414-1414-1414-1414-141414141414', 'vice_principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  begin
    insert into public.behaviour_incidents (school_id, learner_id, academic_year_id, incident_type, description)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11110000-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'positive', 'Trigger probe');
    raise exception 'trigger_probe_rollback';
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  execute 'reset role';
  call test_util.record('SECURITY DEFINER triggers still fire for a signed-in writer', v_error = 'trigger_probe_rollback', v_error);
end $$;
