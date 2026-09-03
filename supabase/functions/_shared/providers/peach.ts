// Peach Payments adapter — https://developer.peachpayments.com
//
// Redirect: Peach's Checkout is created server-to-server (POST to the
// checkout endpoint with the bearer access token / entity id) and returns
// a `redirectUrl`.
//
// Webhook: Peach webhooks are AES-GCM encrypted. The body carries the
// ciphertext (hex), the `X-Initialization-Vector` and `X-Authentication-Tag`
// headers, and the decryption key is the Peach-provided webhook secret
// (hex). We decrypt, then parse the JSON.
//
// Secrets (env): PEACH_ACCESS_TOKEN, PEACH_WEBHOOK_SECRET.
// Non-secret (merchant_config): entity_id.

import type {
  IntentInfo,
  PaymentProviderAdapter,
  ProviderContext,
  RedirectInstruction,
  WebhookResult,
} from './types.ts';
import { buf } from './types.ts';

const CHECKOUT_URL = {
  test: 'https://testsecure.peachpayments.com/checkout/initiate',
  live: 'https://secure.peachpayments.com/checkout/initiate',
};

function hexToBytes(value: string): Uint8Array {
  const clean = value.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export const peachAdapter: PaymentProviderAdapter = {
  name: 'peach',

  async buildRedirect(intent: IntentInfo, ctx: ProviderContext): Promise<RedirectInstruction> {
    const entityId = ctx.merchantConfig.entity_id;
    const accessToken = ctx.secrets.PEACH_ACCESS_TOKEN;
    if (!entityId || !accessToken) throw new Error('peach: entity_id and PEACH_ACCESS_TOKEN are required');

    const form = new URLSearchParams({
      entityId,
      amount: intent.amount.toFixed(2),
      currency: intent.currency,
      merchantTransactionId: intent.reference,
      shopperResultUrl: intent.returnUrl,
      defaultPaymentMethod: 'CARD',
      'customParameters[notificationUrl]': intent.notifyUrl,
    });

    const res = await fetch(CHECKOUT_URL[ctx.mode], {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`peach: checkout initiation failed (${res.status})`);
    const json = (await res.json()) as { redirectUrl?: string; redirect?: { url?: string } };
    const url = json.redirectUrl ?? json.redirect?.url;
    if (!url) throw new Error('peach: no redirect URL in checkout response');
    return { method: 'GET', url, fields: {} };
  },

  async parseWebhook(req: Request, ctx: ProviderContext): Promise<WebhookResult> {
    const secret = ctx.secrets.PEACH_WEBHOOK_SECRET;
    const ivHeader = req.headers.get('x-initialization-vector');
    const tagHeader = req.headers.get('x-authentication-tag');
    const bodyText = await req.text();

    let decoded: Record<string, unknown> | null = null;
    let signatureValid = false;

    if (secret && ivHeader && tagHeader) {
      try {
        const key = await crypto.subtle.importKey('raw', buf(hexToBytes(secret)), { name: 'AES-GCM' }, false, ['decrypt']);
        const ciphertext = hexToBytes(bodyText);
        const tag = hexToBytes(tagHeader);
        const combined = new Uint8Array(ciphertext.length + tag.length);
        combined.set(ciphertext);
        combined.set(tag, ciphertext.length);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(hexToBytes(ivHeader)) }, key, buf(combined));
        decoded = JSON.parse(new TextDecoder().decode(plain));
        signatureValid = true; // AES-GCM decrypt succeeding IS the authentication.
      } catch {
        signatureValid = false;
      }
    }

    if (!decoded) {
      try {
        decoded = JSON.parse(bodyText);
      } catch {
        decoded = {};
      }
    }

    const safeDecoded: Record<string, unknown> = decoded ?? {};
    const payload = (safeDecoded.payload ?? safeDecoded) as Record<string, unknown>;
    const resultCode = String((payload.result as { code?: string } | undefined)?.code ?? payload.resultCode ?? '');
    // Peach success codes: /^(000\.000\.|000\.100\.1|000\.[36])/
    const outcome = /^(000\.000\.|000\.100\.1|000\.[36])/.test(resultCode) ? 'succeeded' : 'failed';

    return {
      providerEventId: String(payload.id ?? payload.ndc ?? `${payload.merchantTransactionId}:${resultCode}`),
      reference: String(payload.merchantTransactionId ?? ''),
      providerReference: (payload.id as string | undefined) ?? null,
      amount: Number(payload.amount ?? 0),
      outcome,
      signatureValid,
      raw: safeDecoded,
    };
  },
};
