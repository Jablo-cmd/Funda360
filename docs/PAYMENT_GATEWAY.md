# Funda360 — Online Payment Gateway Architecture

This document describes the **actual implementation** of online fee payments
(`supabase/migrations/20260903100000_payment_gateway.sql`,
`supabase/functions/payments-*`, `src/features/fees`).

The gateway is **provider-agnostic**. No part of the finance domain hard-codes
a provider. Adding online payments for a school is a configuration action, not
a code change — provided the provider's secrets have been supplied to the Edge
Function environment (below).

## Data model

| Table | Purpose |
|---|---|
| `payment_gateway_configs` | One row per school: chosen `provider`, `test`/`live` `mode`, `enabled` flag, and **non-secret** `merchant_config` (e.g. PayFast `merchant_id`). Finance-tier RLS; guardians cannot read it. |
| `payment_intents` | One attempt to pay an amount, optionally against an invoice. Client-readable (own child / finance), **client-immutable** — only `settle_payment_intent()` writes a terminal status. |
| `payment_webhook_events` | Every inbound provider callback with its signature verdict. `unique (provider, provider_event_id)` makes duplicate delivery a no-op. Finance/platform-admin read-only. |

`learner_fee_payments` remains the single money-of-record. A settled online
payment is booked there as a normal `card` payment and (for an invoice
payment) allocated via `learner_fee_payment_allocations` — there is no
parallel ledger.

## Flow

1. **Initiate (browser → RPC).** `create_payment_intent(learner, amount, invoice?, returnUrl, cancelUrl)` — a guardian or finance user. Validates the school has an `enabled` gateway and that an invoice payment does not exceed the invoice balance. Returns a `created` intent with a unique `reference`.
2. **Redirect (browser → `payments-initiate` Edge Function).** The function loads the intent with the caller's JWT (RLS), loads the gateway config with the service-role key (server-side), and asks the provider adapter to build the redirect (`{ method, url, fields }`). **Provider secrets are read from the function environment and never returned to the browser.** The SPA POSTs a form to `url`.
3. **Provider hosts the payment.** The browser is on the provider's domain.
4. **Webhook (provider → `payments-webhook` Edge Function).** Public endpoint. `provider` and `mode` are query params the initiate step set as the `notify_url`. The adapter parses + verifies the callback (signature / hash / server-confirmation) and returns a normalized result. The function calls `settle_payment_intent()` (service-role).
5. **Settle (`settle_payment_intent`, SECURITY DEFINER, service-role only).**
   - Inserts the webhook event; a `(provider, provider_event_id)` conflict → `duplicate_ignored`.
   - `signature_valid = false` → recorded, **not settled**.
   - Intent already terminal → idempotent no-op.
   - On `succeeded`: **amount must match `payment_intents.amount` to the cent** or the intent is `failed` with `amount_mismatch` and an audit alert. Otherwise it books the `learner_fee_payments` row, allocates it to the invoice, issues a receipt, marks the intent `succeeded`, and notifies guardians.
6. **Return (browser → `/parent/payment-return?intent=<id>`).** Polls `payment_intents.status`. **The URL is never trusted** — only step 5 makes a payment real.

## Provider adapters (`supabase/functions/_shared/providers/`)

Each implements `PaymentProviderAdapter` (`buildRedirect`, `parseWebhook`).
`parseWebhook` always returns an honest `signatureValid`; settlement never
proceeds when it is `false`.

| Provider | Redirect | Webhook verification | Secrets (env) | Non-secret (`merchant_config`) |
|---|---|---|---|---|
| **PayFast** | form POST to `*/eng/process`, MD5 signature | MD5 signature **and** server-to-server `/eng/query/validate` == `VALID` | `PAYFAST_PASSPHRASE` (recommended) | `merchant_id`, `merchant_key` |
| **Ozow** | form POST to pay URL, SHA512 `HashCheck` | SHA512 `Hash` recompute | `OZOW_PRIVATE_KEY`, `OZOW_API_KEY` | `site_code`, `country_code` |
| **Yoco** | server creates Checkout, `GET` its `redirectUrl` | Svix-style HMAC-SHA256 over `id.timestamp.body` | `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET` | `public_key` |
| **Peach** | server initiates Checkout, `GET` its redirect | AES-GCM decrypt of the payload (decrypt success = authentication) | `PEACH_ACCESS_TOKEN`, `PEACH_WEBHOOK_SECRET` | `entity_id` |
| **Netcash** | form POST to Pay Now gateway | `M1` field == Pay Now service key | `NETCASH_PAYNOW_SERVICE_KEY` | `service_key`, `account_number` |

Adapter tests: `supabase/functions/_shared/providers/providers.test.ts`
(`deno test`), also run in CI (`edge-functions` job).

## Deployment / go-live checklist

Nothing below is required for the automated tests — they use fixtures — but
**all of it is required before a real charge can complete**.

1. **Deploy the Edge Functions:**
   ```
   supabase functions deploy payments-initiate
   supabase functions deploy payments-webhook --no-verify-jwt
   ```
   (`payments-webhook` must be public — providers cannot present a Supabase JWT.)
2. **Set the provider secrets** for the deployment (from the provider's dashboard):
   ```
   supabase secrets set PAYFAST_PASSPHRASE=...            # or OZOW_*/YOCO_*/PEACH_*/NETCASH_*
   ```
   One provider account per deployment. Multi-account (different PayFast
   accounts per school) requires extending `readProviderSecrets()` to key by
   school — the interface already isolates this.
3. **Configure the school:** Payment Settings → Online payment provider →
   enter the non-secret identifiers, pick `test`, save, tick *Enable*.
4. **Register the webhook URL** in the provider dashboard:
   `https://<project-ref>.functions.supabase.co/payments-webhook?provider=<provider>&mode=test`
   (Funda360 also sends this as the `notify_url` on each transaction; some
   providers require it to be pre-registered as well.)
5. **Run a sandbox payment** end-to-end. Confirm a `learner_fee_payments`
   row, a `fee_receipts` row, and a `payment_webhook_events` row with
   `signature_valid = true`.
6. Switch the school's mode to `live` and repeat step 4 with `mode=live`.

## Security properties

- Client-side "success" is never trusted (`settle_payment_intent` is the only writer of a terminal state; it is `service_role`-only).
- Duplicate webhooks are idempotent (`unique (provider, provider_event_id)` + already-terminal check).
- Amount is re-verified server-side against the intent.
- Secrets never touch Postgres, the browser, or git.
- Every settlement / failure / mismatch is written to `audit_log`.
- `signature_valid = false` events are retained — a stream of them is an attack signal.
