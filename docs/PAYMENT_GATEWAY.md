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

## Netcash disabled; verified-only de-duplication (audit 2026-10-23)

**Netcash (S-1).** Netcash Pay Now's only callback check is that `M1` equals
the school's service key, but that key is part of the payment form every
payer's browser receives. Anyone who started a Netcash payment could forge an
accepted callback for their own intent and have it booked without paying.
Until callbacks are confirmed server-side with Netcash:

- the database refuses to enable a Netcash gateway
  (`payment_gateway_configs_netcash_not_enabled`, migration `20261023090000`);
- `payments-initiate` refuses to start a Netcash payment;
- `binding.ts` refuses every Netcash callback (`provider_not_verifiable`), and
  `settle_payment_intent()` never settles one even if asked to;
- Payment Settings no longer offers Netcash.

**De-duplication (S-2).** `settle_payment_intent()` used to record every
callback under the `(provider, provider_event_id)` unique constraint before
checking its signature, so a forged callback carrying a genuine event's id
(Ozow shows `TransactionId` to the payer's browser) turned the real callback
into a "duplicate" and the payment never settled. Now only verified callbacks
take part in de-duplication (partial unique index
`payment_webhook_events_verified_event_key`). Unverified callbacks are still
recorded, with `processing_error = 'signature_invalid'` (or
`provider_not_verifiable` for Netcash), as an attack signal. Tests:
`supabase/rls-tests/tests/zzzzzzz_payment_webhook_hardening.test.sql`.
