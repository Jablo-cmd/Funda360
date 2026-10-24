-- Scheduled external notification delivery (follow-up to the 2026-10-23
-- audit, finding O-2). create_notification() already queues one
-- notification_deliveries row per external channel a recipient opted into,
-- and the notifications-dispatch Edge Function can send them (Resend for
-- email, Twilio for SMS and WhatsApp), but nothing ever called it, so no
-- email or SMS was ever sent.
--
-- This adds a pg_cron job that, every two minutes and only while deliveries
-- are due, calls notifications-dispatch through pg_net with the shared
-- dispatch secret. It does nothing until the platform owner stores two
-- Vault secrets (docs/NOTIFICATIONS_DELIVERY.md):
--   notifications_dispatch_secret  same value as the Edge Function's
--                                  NOTIFICATIONS_DISPATCH_SECRET
--   project_url                    https://<project-ref>.supabase.co
-- Channels without provider keys stay 'pending' in the function, as before.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

create or replace function public.dispatch_notifications_tick()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_url text;
  v_due integer;
  v_request_id bigint;
begin
  select count(*) into v_due
  from public.notification_deliveries
  where status = 'pending' and attempts < 5 and scheduled_for <= now();
  if v_due = 0 then
    return 'nothing_due';
  end if;

  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return 'not_configured';
  end if;

  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'notifications_dispatch_secret' limit 1$q$
    into v_secret;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1$q$
    into v_url;
  if coalesce(v_secret, '') = '' or coalesce(v_url, '') = '' then
    return 'not_configured';
  end if;

  execute $q$select net.http_post(
      url := $1,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', $2),
      body := jsonb_build_object('limit', 50),
      timeout_milliseconds := 60000
    )$q$
    into v_request_id
    using rtrim(v_url, '/') || '/functions/v1/notifications-dispatch', v_secret;

  return 'dispatched:' || v_due;
end;
$$;

comment on function public.dispatch_notifications_tick() is
  'pg_cron entry point: when external deliveries are due, calls the notifications-dispatch Edge Function through pg_net with the Vault-held dispatch secret. Returns nothing_due, not_configured or dispatched:<n>. Never callable by clients.';

revoke execute on function public.dispatch_notifications_tick() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'notifications-dispatch-tick') then
    perform cron.unschedule('notifications-dispatch-tick');
  end if;
  perform cron.schedule('notifications-dispatch-tick', '*/2 * * * *', 'select public.dispatch_notifications_tick()');
end $$;
