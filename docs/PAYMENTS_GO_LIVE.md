# Online fee payments: go-live runbook

Status (2026-10-24): the payment code is complete and tested.

- **Settlement:** callbacks are bound to the right school, provider and mode; the amount is re-checked in SQL; duplicates are refused; forged callbacks are logged and never settle; Netcash is disabled; return links are validated.
- **Not yet done:** no school has a gateway configured, and no real payment has been made.

This runbook takes one school from nothing to a verified live payment. Use PayFast first: it is the most common provider for South African schools. Ozow follows the same steps with its own keys.

## 1. PayFast sandbox (no real money)

1. **Create a sandbox account.** Go to <https://sandbox.payfast.co.za> and note the sandbox **Merchant ID**, **Merchant Key** and **Passphrase** (Settings → Developer Settings).
2. **Set the Edge Function secrets.** In Supabase, go to Edge Functions → Secrets:
   - `PAYFAST_PASSPHRASE`: the sandbox passphrase;
   - `APP_ALLOWED_ORIGINS`: `https://app.funda360.aurisnexus.co.za`. Add a staging address too if you have one, comma-separated.
3. **Configure the school.** Sign in to Funda360 as that school's owner or finance manager. Go to **Finance → Payment Settings** and set:
   - provider **PayFast**, mode **Test / sandbox**;
   - the sandbox Merchant ID and Merchant Key;
   - **Enabled**: on.
4. **Make a test payment.** Sign in as a guardian of a learner with an issued invoice. On **Fees**, click **Pay now**. On the PayFast sandbox page, pay with the sandbox wallet.
5. **Check the result** in the Supabase SQL editor:
   ```sql
   select status, amount, provider_reference, completed_at
     from payment_intents order by created_at desc limit 1;            -- expect: succeeded
   select signature_valid, processing_error, status_reported
     from payment_webhook_events order by received_at desc limit 3;    -- expect: true, null, succeeded
   select amount, method, reference from learner_fee_payments
     order by created_at desc limit 1;                                 -- expect: the same amount, method card
   ```
   The guardian should also see "Payment received" in Notifications, and a receipt on the invoice.
6. **Check what must fail.**
   - Cancel a payment on the PayFast page. The intent should become `cancelled`, with no payment recorded.
   - Replay the same webhook (PayFast sandbox → ITN history → resend). It should be recorded as `duplicate_ignored`, with no second payment.

If step 5 shows `signature_valid = false`, the `processing_error` and the `_funda360_binding_problems` field in `payload` say why. Common causes:

- the passphrase in Supabase differs from the one in PayFast;
- the merchant ID in Payment Settings differs from the one on the account;
- the mode is set to live while you are using sandbox keys.

## 2. Going live

1. Complete PayFast merchant onboarding (business verification and bank account).
2. Replace `PAYFAST_PASSPHRASE` with the **live** passphrase. Live mode refuses callbacks when no passphrase is set.
3. In Payment Settings, switch to mode **Live** with the live Merchant ID and Merchant Key.
4. Make one small real payment (for example R5 against a test invoice) and run the checks in step 5 again.
5. Record the live configuration date and who verified it, for example in the Trust Center audit log.

## 3. Day-to-day checks

- **Unverified callbacks:** the platform dashboard shows "Unverified payment callbacks (7 days)". A sudden rise means someone is probing the webhook, or a configuration has drifted.
- **Bank reconciliation:** Finance → Bank Reconciliation matches settled card payments to bank statement lines.
- **Refunds:** process them in the PayFast dashboard, then record them in Funda360 (Fees → learner → Refund) so the ledger matches.

## 4. Other providers

| Provider  | Secrets                                   | Payment Settings fields | Notes                                                                                        |
| --------- | ----------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| Ozow      | `OZOW_PRIVATE_KEY`, `OZOW_API_KEY`        | Site Code, Country Code | Instant EFT. The callback carries a SHA-512 hash.                                            |
| Yoco      | `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`  | Public Key              | Signed webhooks; replays older than 5 minutes are refused.                                   |
| Peach     | `PEACH_ACCESS_TOKEN`, `PEACH_WEBHOOK_SECRET` | Entity ID            | Encrypted webhooks.                                                                          |
| Netcash   | n/a                                       | n/a                     | **Disabled.** Its callbacks cannot be authenticated (audit 2026-10-23, S-1).                 |
