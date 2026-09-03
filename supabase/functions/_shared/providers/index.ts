import type { PaymentProviderAdapter, ProviderContext } from './types.ts';
import { payfastAdapter } from './payfast.ts';
import { ozowAdapter } from './ozow.ts';
import { peachAdapter } from './peach.ts';
import { yocoAdapter } from './yoco.ts';
import { netcashAdapter } from './netcash.ts';

const ADAPTERS: Record<string, PaymentProviderAdapter> = {
  payfast: payfastAdapter,
  ozow: ozowAdapter,
  peach: peachAdapter,
  yoco: yocoAdapter,
  netcash: netcashAdapter,
};

export function getAdapter(provider: string): PaymentProviderAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Unknown payment provider: ${provider}`);
  return adapter;
}

/**
 * Reads a provider's secrets from the Edge Function environment. Naming
 * convention: <PROVIDER>_<NAME> uppercased, e.g. PAYFAST_PASSPHRASE,
 * OZOW_PRIVATE_KEY. See docs/PAYMENT_GATEWAY.md for the full list per
 * provider. Returns every FUNDA360-visible env var prefixed with the
 * provider name so an adapter can pick what it needs.
 */
export function readProviderSecrets(provider: string): Record<string, string> {
  const prefix = `${provider.toUpperCase()}_`;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    if (key.startsWith(prefix) && value) out[key] = value;
  }
  return out;
}

export function buildContext(
  provider: string,
  merchantConfig: Record<string, string>,
  mode: 'test' | 'live',
): ProviderContext {
  return { merchantConfig, secrets: readProviderSecrets(provider), mode };
}

export type { PaymentProviderAdapter, ProviderContext };
