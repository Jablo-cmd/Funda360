# Funda360 — Reconciled Documentation

**Current as of:** 2026-09-24  
**Authoritative register:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> This document is reconciled against implementation evidence. Planned, partial and configuration-dependent capabilities are not presented as live.

## Current status
Finance and payment workflow architecture exist, with charges, payments, allocations, adjustments, refunds and relevant security/testing coverage.

**No payment provider is claimed live without real production credentials/configuration and successful end-to-end verification.**

Go-live requires provider account, secrets, webhook verification, idempotency, reconciliation, refund handling, audit trail, failure handling and hosted-environment testing.
## Settlement binding (audit P1-5, 2026-09-30)

`payments-webhook` never trusts the `provider` and `mode` query parameters on
their own. A callback settles only when all of the following hold (see
`supabase/functions/_shared/providers/binding.ts`, tested in `binding.test.ts`):

- the adapter's signature or integrity check passes;
- the referenced intent exists and was created for the same provider and mode;
- the intent's school has an **enabled** gateway config for that provider and mode;
- where the provider echoes a merchant identifier (PayFast `merchant_id`,
  Ozow `SiteCode`), it equals that school's configured value;
- live PayFast has `PAYFAST_PASSPHRASE` set. Without a passphrase the PayFast
  signature is not a secret, so live callbacks are refused.

A refused callback is still recorded in `payment_webhook_events`, with
`signature_valid = false` and the reasons under
`payload._funda360_binding_problems`. It never books a payment.
