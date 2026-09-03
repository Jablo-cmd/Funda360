// PayFast adapter — https://developers.payfast.co.za
//
// Redirect: an HTML form POST to the process endpoint with an MD5
// signature over the URL-encoded field string (field order matters) plus
// the optional passphrase.
//
// ITN (webhook): PayFast POSTs form-encoded data to notify_url. We verify
// in four independent ways before treating it as real:
//   1. signature — MD5 of the posted fields (minus `signature`) + passphrase
//   2. source host — must be a known PayFast IP/host (checked by caller via
//      allowlist is out of scope here; we check the `pf` domain of the
//      validate call instead)
//   3. server confirmation — POST the untouched payload back to
//      /eng/query/validate and require the body `VALID`
//   4. amount — asserted by settle_payment_intent() in Postgres
//
// Secrets (env): PAYFAST_PASSPHRASE (optional but strongly recommended).
// Non-secret (merchant_config): merchant_id, merchant_key.

import { crypto as stdCrypto } from 'jsr:@std/crypto@1';
import type {
  IntentInfo,
  PaymentProviderAdapter,
  ProviderContext,
  RedirectInstruction,
  WebhookResult,
} from './types.ts';
import { hex, timingSafeEqual } from './types.ts';

const PROCESS_URL = {
  test: 'https://sandbox.payfast.co.za/eng/process',
  live: 'https://www.payfast.co.za/eng/process',
};
const VALIDATE_URL = {
  test: 'https://sandbox.payfast.co.za/eng/query/validate',
  live: 'https://www.payfast.co.za/eng/query/validate',
};

async function md5Hex(input: string): Promise<string> {
  const digest = await stdCrypto.subtle.digest('MD5', new TextEncoder().encode(input));
  return hex(new Uint8Array(digest));
}

/** PayFast's signing string: `key=urlencode(value)` joined by `&`, spaces as `+`, in the given field order, then `&passphrase=...`. Exported for tests. */
export function payfastSignature(fields: [string, string][], passphrase: string | undefined): Promise<string> {
  return signature(fields, passphrase);
}

function signature(fields: [string, string][], passphrase: string | undefined): Promise<string> {
  const parts = fields
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(value.trim()).replace(/%20/g, '+')}`);
  if (passphrase) parts.push(`passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`);
  return md5Hex(parts.join('&'));
}

export const payfastAdapter: PaymentProviderAdapter = {
  name: 'payfast',

  async buildRedirect(intent: IntentInfo, ctx: ProviderContext): Promise<RedirectInstruction> {
    const merchantId = ctx.merchantConfig.merchant_id;
    const merchantKey = ctx.merchantConfig.merchant_key;
    if (!merchantId || !merchantKey) throw new Error('payfast: merchant_id and merchant_key are required');

    const fields: [string, string][] = [
      ['merchant_id', merchantId],
      ['merchant_key', merchantKey],
      ['return_url', intent.returnUrl],
      ['cancel_url', intent.cancelUrl],
      ['notify_url', intent.notifyUrl],
      ['m_payment_id', intent.reference],
      ['amount', intent.amount.toFixed(2)],
      ['item_name', intent.itemName],
      ['item_description', intent.itemDescription],
    ];
    if (intent.buyerEmail) fields.push(['email_address', intent.buyerEmail]);

    const sig = await signature(fields, ctx.secrets.PAYFAST_PASSPHRASE);

    return {
      method: 'POST',
      url: PROCESS_URL[ctx.mode],
      fields: { ...Object.fromEntries(fields), signature: sig },
    };
  },

  async parseWebhook(req: Request, ctx: ProviderContext): Promise<WebhookResult> {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const posted: Record<string, string> = {};
    for (const [k, v] of params.entries()) posted[k] = v;

    // 1. Signature — rebuild over every posted field except `signature`, in
    // posted order (PayFast documents "the order in which they appear in
    // the notification").
    const orderedFields: [string, string][] = [];
    for (const [k, v] of params.entries()) {
      if (k === 'signature') continue;
      orderedFields.push([k, v]);
    }
    const expected = await signature(orderedFields, ctx.secrets.PAYFAST_PASSPHRASE);
    const signatureValid = typeof posted.signature === 'string' && timingSafeEqual(expected, posted.signature);

    // 3. Server confirmation — POST the raw payload back and require VALID.
    let serverValid = false;
    try {
      const res = await fetch(VALIDATE_URL[ctx.mode], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      serverValid = (await res.text()).trim().toUpperCase().startsWith('VALID');
    } catch {
      serverValid = false;
    }

    const status = (posted.payment_status ?? '').toUpperCase();
    const outcome =
      status === 'COMPLETE' ? 'succeeded' : status === 'CANCELLED' ? 'cancelled' : 'failed';

    return {
      providerEventId: posted.pf_payment_id ?? `${posted.m_payment_id}:${posted.payment_status}`,
      reference: posted.m_payment_id ?? '',
      providerReference: posted.pf_payment_id ?? null,
      amount: Number(posted.amount_gross ?? posted.amount ?? 0),
      outcome,
      signatureValid: signatureValid && serverValid,
      raw: posted,
    };
  },
};
