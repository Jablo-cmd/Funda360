-- Regression suite for 20261024100000_notification_dispatch_schedule.sql.
-- The scheduled tick is a server-side job: no client role may call it, and
-- without Vault secrets (as in this harness) it reports not_configured
-- instead of failing.

do $$
declare
  v_auth boolean;
  v_anon boolean;
  v_result text;
  v_queued uuid;
begin
  v_auth := has_function_privilege('authenticated', 'public.dispatch_notifications_tick()', 'execute');
  v_anon := has_function_privilege('anon', 'public.dispatch_notifications_tick()', 'execute');
  call test_util.record('dispatch tick: not executable by authenticated or anon', not v_auth and not v_anon,
    format('authenticated %s anon %s', v_auth, v_anon));

  -- Queue one due delivery so the tick gets past "nothing due".
  insert into public.notification_deliveries (notification_id, school_id, recipient_profile_id, channel, destination, status, scheduled_for)
  select n.id, n.school_id, n.recipient_profile_id, 'email', 'parent@example.test', 'pending', now() - interval '1 minute'
  from public.notifications n where n.school_id is not null limit 1
  returning id into v_queued;

  v_result := public.dispatch_notifications_tick();
  call test_util.record('dispatch tick: without Vault secrets it reports not_configured',
    v_queued is not null and v_result = 'not_configured', coalesce(v_result, 'null') || ' queued ' || coalesce(v_queued::text, 'none'));

  delete from public.notification_deliveries where id = v_queued;
end $$;
