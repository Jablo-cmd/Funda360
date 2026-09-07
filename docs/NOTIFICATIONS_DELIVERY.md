# Notification delivery architecture (email / SMS / WhatsApp)

Domain 4. The app has always delivered notifications **in-app only**
(`notifications` rows, the header bell, the `/notifications` inbox). This
document describes the architecture that lets those same notifications also
be delivered by email, SMS, or WhatsApp — and is explicit that **nothing is
actually sent until a real provider's credentials are supplied**, exactly
the same external-blocker shape as the Finance payment gateway
([PAYMENT_GATEWAY.md](./PAYMENT_GATEWAY.md)).

## The pieces

| Piece | Role |
| ----- | ---- |
| `notification_preferences` | Per-user opt-in per channel (+ per-type overrides + quiet hours). In-app is never disable-able. |
| `school_messaging_settings` | Per-school kill-switch + non-secret config (`email_from_name`, `email_reply_to`, `sms_sender_id`, `*_provider` names). **No API keys, tokens, or passwords are ever stored here.** Managed at `/settings/messaging` (`school.manage`). |
| `notification_deliveries` | The outbox. One row per (notification, external channel) that was opted into. `status` starts `pending` (`skipped` if the recipient has no email/phone on file). |
| `resolve_notification_channels(profile, school, type)` | Decides which external channels a given notification should attempt: the school switch AND the user preference (global, then per-type override) must both be on. |
| `notification_delivery_schedule(profile)` | `now()`, unless the recipient is inside their quiet-hours window, in which case the next end-of-window. |
| `enqueue_notification_deliveries(notification_id)` | Called at the end of `create_notification()` — inserts the `pending` rows. Every existing and future producer gets multi-channel delivery for free. |
| `supabase/functions/notifications-dispatch` | The **worker**. Drains `pending` rows and calls the provider adapters. |

## The hand-off point

```
select * from notification_deliveries
where status = 'pending' and attempts < 5 and scheduled_for <= now()
order by scheduled_for
limit N;
```

For each row the worker calls the adapter for its `channel`, then updates
the row to `sent` (with `provider_message_id`) or, on failure, back to
`pending` with `attempts + 1` and an `error` — or `failed` once
`attempts` reaches 5.

## `notifications-dispatch` Edge Function

- **Auth:** `POST` with header `x-dispatch-secret: <NOTIFICATIONS_DISPATCH_SECRET>`. If that env var is unset the function returns `401` for every request (fail-closed).
- **Body (optional):** `{ "limit": <1..200> }` (default 50).
- **Adapters:**
  - `email` → **Resend** — `RESEND_API_KEY`, `RESEND_FROM` (default `Funda360 <notifications@funda360.app>`).
  - `sms` → **Twilio** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`.
  - `whatsapp` → **Twilio** — `… `, `TWILIO_WHATSAPP_FROM`.
- If a channel's secret(s) are absent, its `pending` rows are **left untouched** (`skippedUnconfigured` in the response). The adapter exists; activation waits for real credentials.
- Response: `{ ok, scanned, sent, failed, skippedUnconfigured }`.

## Production activation

1. `supabase functions deploy notifications-dispatch`
2. `supabase secrets set NOTIFICATIONS_DISPATCH_SECRET=… RESEND_API_KEY=… TWILIO_ACCOUNT_SID=… TWILIO_AUTH_TOKEN=… TWILIO_SMS_FROM=… TWILIO_WHATSAPP_FROM=…` (only the ones you use).
3. Schedule it — `pg_cron` (`select net.http_post(...)` every minute) or any external scheduler — the same way the fee-overdue / attendance-alert workers are described in Domain 19.
4. Enable the channels per school at `/settings/messaging`.

Until step 1–3 are done, `notification_deliveries` rows accumulate as
`pending` and the in-app notification is completely unaffected. The app
never claims an external message was sent that wasn't.

## What is deferred to Domain 19

Scheduled execution wiring (`pg_cron` job rows), a delivery-status
dashboard, provider webhooks for bounce/delivery receipts, and template
theming per school. Domain 4 ships the queue, the preferences, the
per-school config, and the worker with real adapters.
