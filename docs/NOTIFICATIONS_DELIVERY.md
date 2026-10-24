# Funda360 — Reconciled Documentation

**Current as of:** 2026-09-24  
**Authoritative register:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> This document is reconciled against implementation evidence. Planned, partial and configuration-dependent capabilities are not presented as live.

## Current implementation
In-app notification records and an outbox/adapter architecture exist for email, SMS and WhatsApp. External delivery is configuration-dependent and must not be described as active without provider secrets, sender configuration, deployed functions and end-to-end verification.

Unconfigured channels should remain pending/fail closed rather than silently claiming delivery. Scheduled delivery is an expansion area unless a deployed scheduler is verified.
## Switching on email, SMS and WhatsApp (2026-10-24)

The pipeline works as follows:

1. **Queue.** `create_notification()` queues one `notification_deliveries` row per external channel the recipient opted into. Quiet hours move `scheduled_for`.
2. **Send.** The `notifications-dispatch` Edge Function sends the queued rows: email via Resend, SMS and WhatsApp via Twilio. Each message carries a full link built from `APP_BASE_URL`, which defaults to `https://app.funda360.aurisnexus.co.za`.
3. **Schedule.** The pg_cron job `notifications-dispatch-tick` (migration `20261024100000`) runs every 2 minutes. When deliveries are due, it calls the function through pg_net with the shared dispatch secret.

Until the steps below are done, nothing is sent and rows stay `pending`. A channel without provider keys also stays `pending`.

### One-time set-up (platform owner)

1. **Choose providers and get keys.**
   - **Email:** a Resend API key and a verified sending domain (for example `notifications@funda360.aurisnexus.co.za`).
   - **SMS / WhatsApp:** a Twilio account SID, an auth token, an SMS sender number and/or a WhatsApp sender.
2. **Set the Edge Function secrets.** In Supabase, go to Edge Functions → Secrets and add:
   - `NOTIFICATIONS_DISPATCH_SECRET`: a long random value, for example from `openssl rand -hex 32`;
   - `RESEND_API_KEY` and `RESEND_FROM` (for example `Funda360 <notifications@funda360.aurisnexus.co.za>`);
   - optionally `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`;
   - optionally `APP_BASE_URL`, only if the app moves to another address.
3. **Give the scheduler the same secret.** In Supabase, go to SQL Editor and run:
   ```sql
   select vault.create_secret('<the same NOTIFICATIONS_DISPATCH_SECRET>', 'notifications_dispatch_secret');
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   ```
4. **Check it.** Turn on email in your own Notification Preferences and trigger a notification, such as an announcement to staff. Within about 2 minutes:
   - `select status, error from notification_deliveries order by created_at desc limit 5;` should show `sent`;
   - `select public.dispatch_notifications_tick();`, run as the postgres user in the SQL Editor, returns `nothing_due`, `not_configured` or `dispatched:<n>`.

Rotating the secret means updating both the Edge Function secret and the Vault entry, for example with `vault.update_secret`.
