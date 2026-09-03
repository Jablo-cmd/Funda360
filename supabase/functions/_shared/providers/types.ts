// Provider-agnostic payment adapter contract. Each concrete adapter
// (payfast.ts, ozow.ts, …) implements this; nothing else in the codebase
// knows a provider's name. See docs/PAYMENT_GATEWAY.md.

export type PaymentMode = 'test' | 'live';

export interface ProviderContext {
  /** Non-secret identifiers from payment_gateway_configs.merchant_config. */
  merchantConfig: Record<string, string>;
  /** Secrets from the Edge Function environment — NEVER from the database or the client. */
  secrets: Record<string, string>;
  mode: PaymentMode;
}

export interface IntentInfo {
  reference: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  itemName: string;
  itemDescription: string;
  buyerEmail?: string | null;
}

export interface RedirectInstruction {
  method: 'GET' | 'POST';
  url: string;
  fields: Record<string, string>;
}

export type WebhookOutcome = 'succeeded' | 'failed' | 'cancelled' | 'expired';

export interface WebhookResult {
  /** Provider's unique id for this event/transaction — the dedupe key. */
  providerEventId: string;
  /** Our merchant reference (payment_intents.reference). */
  reference: string;
  providerReference: string | null;
  amount: number;
  outcome: WebhookOutcome;
  /** Result of the adapter's own signature / integrity verification. Settlement never proceeds when false. */
  signatureValid: boolean;
  raw: unknown;
}

export interface PaymentProviderAdapter {
  readonly name: string;
  buildRedirect(intent: IntentInfo, ctx: ProviderContext): Promise<RedirectInstruction> | RedirectInstruction;
  parseWebhook(req: Request, ctx: ProviderContext): Promise<WebhookResult>;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return hex(new Uint8Array(digest));
}

export async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-512', data);
  return hex(new Uint8Array(digest));
}

export async function hmacSha256Hex(secret: string, input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return hex(new Uint8Array(sig));
}

/** A fresh ArrayBuffer copy of a byte view — Web Crypto's TS types reject a plain `Uint8Array` (its `.buffer` may be a `SharedArrayBuffer`). */
export function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string compare for signatures. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
