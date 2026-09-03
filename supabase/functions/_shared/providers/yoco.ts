// Yoco adapter — https://developer.yoco.com
//
// Redirect: Yoco Checkout is created server-to-server (POST /checkouts with
// the secret key) and returns a `redirectUrl` we send the browser to via a
// simple GET.
//
// Webhook: Yoco signs webhooks in the Svix style — headers `webhook-id`,
// `webhook-timestamp`, `webhook-signature`; the signed content is
// `${id}.${timestamp}.${body}` and the signature is base64(HMAC-SHA256)
// keyed by the webhook secret (the part after `whsec_`, base64-decoded).
//
// Secrets (env): YOCO_SECRET_KEY, YOCO_WEBHOOK_SECRET.
// Non-secret (merchant_config): public_key (used only by the browser SDK, optional here).

import type {
  IntentInfo,
  PaymentProviderAdapter,
  ProviderContext,
  RedirectInstruction,
  WebhookResult,
} from './types.ts';
import { buf, timingSafeEqual } from './types.ts';

const CHECKOUT_URL = 'https://payments.yoco.com/api/checkouts';

async function hmacSha256Base64(secretBytes: Uint8Array, input: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', buf(secretBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, buf(new TextEncoder().encode(input)));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export const yocoAdapter: PaymentProviderAdapter = {
  name: 'yoco',

  async buildRedirect(intent: IntentInfo, ctx: ProviderContext): Promise<RedirectInstruction> {
    const secretKey = ctx.secrets.YOCO_SECRET_KEY;
    if (!secretKey) throw new Error('yoco: YOCO_SECRET_KEY is required');

    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(intent.amount * 100),
        currency: intent.currency,
        successUrl: intent.returnUrl,
        cancelUrl: intent.cancelUrl,
        failureUrl: intent.cancelUrl,
        metadata: { reference: intent.reference },
        externalId: intent.reference,
      }),
    });
    if (!res.ok) throw new Error(`yoco: checkout creation failed (${res.status})`);
    const json = (await res.json()) as { redirectUrl?: string };
    if (!json.redirectUrl) throw new Error('yoco: no redirectUrl in checkout response');

    return { method: 'GET', url: json.redirectUrl, fields: {} };
  },

  async parseWebhook(req: Request, ctx: ProviderContext): Promise<WebhookResult> {
    const body = await req.text();
    const id = req.headers.get('webhook-id') ?? '';
    const timestamp = req.headers.get('webhook-timestamp') ?? '';
    const sigHeader = req.headers.get('webhook-signature') ?? '';

    let signatureValid = false;
    const rawSecret = ctx.secrets.YOCO_WEBHOOK_SECRET ?? '';
    if (rawSecret && id && timestamp && sigHeader) {
      const secretBytes = Uint8Array.from(atob(rawSecret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
      const expected = await hmacSha256Base64(secretBytes, `${id}.${timestamp}.${body}`);
      // The header is a space-separated list of `v1,<sig>` pairs.
      signatureValid = sigHeader
        .split(' ')
        .map((part) => part.split(',')[1] ?? '')
        .some((candidate) => candidate.length > 0 && timingSafeEqual(candidate, expected));
    }

    const event = JSON.parse(body) as {
      type?: string;
      payload?: { id?: string; status?: string; amount?: number; metadata?: { reference?: string } };
    };
    const payload = event.payload ?? {};
    const status = (payload.status ?? event.type ?? '').toLowerCase();
    const outcome =
      status.includes('succeeded') || status === 'payment.succeeded'
        ? 'succeeded'
        : status.includes('cancel')
          ? 'cancelled'
          : 'failed';

    return {
      providerEventId: id || (payload.id ?? ''),
      reference: payload.metadata?.reference ?? '',
      providerReference: payload.id ?? null,
      amount: (payload.amount ?? 0) / 100,
      outcome,
      signatureValid,
      raw: event,
    };
  },
};
