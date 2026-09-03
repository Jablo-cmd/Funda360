// Netcash Pay Now adapter — https://api.netcash.co.za/inbound-payments/pay-now/
//
// Redirect: an HTML form POST to the Pay Now gateway with the service key,
// amounts, and reference fields. Netcash does not sign the request form;
// integrity of the response is what matters.
//
// Webhook (Accept/Notify): Netcash POSTs form-encoded data back. There is
// no HMAC; Netcash's documented verification is (a) the `M1` field equals
// your Pay Now service key, (b) `TransactionAccepted` is `true`, and (c)
// the amount matches — (c) is enforced in Postgres by
// settle_payment_intent(). We treat (a) as the signature check.
//
// Secrets (env): NETCASH_PAYNOW_SERVICE_KEY (also stored as merchant_config
// for the outbound form; kept in env too so webhook verification never
// depends on a client-writable value).
// Non-secret (merchant_config): service_key, account_number.

import type {
  IntentInfo,
  PaymentProviderAdapter,
  ProviderContext,
  RedirectInstruction,
  WebhookResult,
} from './types.ts';
import { timingSafeEqual } from './types.ts';

const GATEWAY_URL = 'https://paynow.netcash.co.za/site/paynow.aspx';

export const netcashAdapter: PaymentProviderAdapter = {
  name: 'netcash',

  buildRedirect(intent: IntentInfo, ctx: ProviderContext): RedirectInstruction {
    const serviceKey = ctx.merchantConfig.service_key || ctx.secrets.NETCASH_PAYNOW_SERVICE_KEY;
    if (!serviceKey) throw new Error('netcash: service_key is required');

    return {
      method: 'POST',
      url: GATEWAY_URL,
      fields: {
        M1: serviceKey,
        M2: '24ade73c-98ce-47bf-a1e9-4b4c8b0d2e2f', // Netcash's fixed software vendor key for custom integrations
        p2: intent.reference,
        p3: intent.itemName,
        p4: intent.amount.toFixed(2),
        Budget: 'Y',
        m4: intent.notifyUrl,
        m5: intent.returnUrl,
        m6: intent.cancelUrl,
        m9: intent.buyerEmail ?? '',
      },
    };
  },

  async parseWebhook(req: Request, ctx: ProviderContext): Promise<WebhookResult> {
    const params = new URLSearchParams(await req.text());
    const data: Record<string, string> = {};
    for (const [k, v] of params.entries()) data[k] = v;

    const expectedKey = ctx.secrets.NETCASH_PAYNOW_SERVICE_KEY ?? ctx.merchantConfig.service_key ?? '';
    const signatureValid = expectedKey.length > 0 && timingSafeEqual(expectedKey, data.M1 ?? '');

    const accepted = (data.TransactionAccepted ?? '').toLowerCase() === 'true';
    const outcome = accepted ? 'succeeded' : (data.Reason ?? '').toLowerCase().includes('cancel') ? 'cancelled' : 'failed';

    return {
      providerEventId: data.RequestTrace ?? `${data.p2}:${data.TransactionAccepted}`,
      reference: data.p2 ?? data.Reference ?? '',
      providerReference: data.RequestTrace ?? null,
      amount: Number(data.Amount ?? data.p4 ?? 0),
      outcome,
      signatureValid,
      raw: data,
    };
  },
};
