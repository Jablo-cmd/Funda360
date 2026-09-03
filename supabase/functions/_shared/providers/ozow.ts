// Ozow adapter — https://hub.ozow.com/docs
//
// Redirect: a GET/POST to the Ozow pay URL with a HashCheck = SHA512 of
// the concatenated request fields (in Ozow's documented order) + the
// private key, lower-cased.
//
// Webhook (notify/callback): Ozow POSTs (form or JSON) with a Hash field
// computed the same way over the response fields. We recompute and compare.
//
// Secrets (env): OZOW_PRIVATE_KEY, OZOW_API_KEY.
// Non-secret (merchant_config): site_code, country_code.

import type {
  IntentInfo,
  PaymentProviderAdapter,
  ProviderContext,
  RedirectInstruction,
  WebhookResult,
} from './types.ts';
import { sha512Hex, timingSafeEqual } from './types.ts';

const PAY_URL = {
  test: 'https://stagingpay.ozow.com',
  live: 'https://pay.ozow.com',
};

function lc(value: string): string {
  return value.toLowerCase();
}

/** Ozow response HashCheck: SHA512(lowercase(concat(fields in order) + privateKey)). Exported for tests. */
export async function ozowResponseHash(data: Record<string, string>, privateKey: string): Promise<string> {
  const order = [
    'SiteCode', 'TransactionId', 'TransactionReference', 'Amount', 'Status',
    'Optional1', 'Optional2', 'Optional3', 'Optional4', 'Optional5',
    'CurrencyCode', 'IsTest', 'StatusMessage',
  ];
  const concat = order.map((k) => data[k] ?? '').join('') + privateKey;
  return (await sha512Hex(concat.toLowerCase())).toLowerCase();
}

export const ozowAdapter: PaymentProviderAdapter = {
  name: 'ozow',

  async buildRedirect(intent: IntentInfo, ctx: ProviderContext): Promise<RedirectInstruction> {
    const siteCode = ctx.merchantConfig.site_code;
    const countryCode = ctx.merchantConfig.country_code || 'ZA';
    const privateKey = ctx.secrets.OZOW_PRIVATE_KEY;
    if (!siteCode || !privateKey) throw new Error('ozow: site_code and OZOW_PRIVATE_KEY are required');

    const isTest = ctx.mode === 'test';
    const fields: Record<string, string> = {
      SiteCode: siteCode,
      CountryCode: countryCode,
      CurrencyCode: intent.currency,
      Amount: intent.amount.toFixed(2),
      TransactionReference: intent.reference,
      BankReference: intent.reference.slice(0, 20),
      IsTest: String(isTest),
      SuccessUrl: intent.returnUrl,
      CancelUrl: intent.cancelUrl,
      ErrorUrl: intent.cancelUrl,
      NotifyUrl: intent.notifyUrl,
    };

    // Ozow's documented hash input order for the request.
    const order = [
      'SiteCode',
      'CountryCode',
      'CurrencyCode',
      'Amount',
      'TransactionReference',
      'BankReference',
      'Optional1',
      'Optional2',
      'Optional3',
      'Optional4',
      'Optional5',
      'Customer',
      'CancelUrl',
      'ErrorUrl',
      'SuccessUrl',
      'NotifyUrl',
      'IsTest',
    ];
    const concat = order.map((k) => fields[k] ?? '').join('') + privateKey;
    fields.HashCheck = lc(await sha512Hex(lc(concat)));

    return { method: 'POST', url: `${PAY_URL[isTest ? 'test' : 'live']}`, fields };
  },

  async parseWebhook(req: Request, ctx: ProviderContext): Promise<WebhookResult> {
    const privateKey = ctx.secrets.OZOW_PRIVATE_KEY ?? '';
    const contentType = req.headers.get('content-type') ?? '';
    let data: Record<string, string> = {};
    if (contentType.includes('application/json')) {
      data = await req.json();
    } else {
      const params = new URLSearchParams(await req.text());
      for (const [k, v] of params.entries()) data[k] = v;
    }

    // Ozow response hash input order.
    const order = [
      'SiteCode',
      'TransactionId',
      'TransactionReference',
      'Amount',
      'Status',
      'Optional1',
      'Optional2',
      'Optional3',
      'Optional4',
      'Optional5',
      'CurrencyCode',
      'IsTest',
      'StatusMessage',
    ];
    const concat = order.map((k) => data[k] ?? '').join('') + privateKey;
    const expected = (await sha512Hex(concat.toLowerCase())).toLowerCase();
    const providedHash = (data.Hash ?? data.HashCheck ?? '').toLowerCase();
    const signatureValid = providedHash.length > 0 && timingSafeEqual(expected, providedHash);

    const status = (data.Status ?? '').toLowerCase();
    const outcome =
      status === 'complete' || status === 'completed'
        ? 'succeeded'
        : status === 'cancelled'
          ? 'cancelled'
          : status === 'pendinginvestigation' || status === 'pending'
            ? 'failed'
            : 'failed';

    return {
      providerEventId: data.TransactionId ?? `${data.TransactionReference}:${data.Status}`,
      reference: data.TransactionReference ?? '',
      providerReference: data.TransactionId ?? null,
      amount: Number(data.Amount ?? 0),
      outcome,
      signatureValid,
      raw: data,
    };
  },
};
