// Settlement binding (audit P1-5). A provider callback may only settle the
// payment intent it was created for: same provider, same mode, the school's
// own enabled gateway configuration, and — where the provider echoes a
// merchant identifier in the callback — that school's merchant. Without
// this, a genuine payment made to *any* merchant (or a sandbox payment sent
// with mode=test) that carried a victim's reference and amount could settle
// the victim's live intent. The webhook treats any problem returned here
// exactly like an invalid signature: recorded, never settled.

import type { PaymentMode } from './types.ts';

export interface IntentForBinding {
  school_id: string;
  provider: string;
  mode: PaymentMode;
}

export interface GatewayConfigForBinding {
  school_id: string;
  provider: string;
  mode: PaymentMode;
  enabled: boolean;
  merchant_config: Record<string, string>;
}

export interface BindingInput {
  provider: string;
  mode: PaymentMode;
  intent: IntentForBinding | null;
  config: GatewayConfigForBinding | null;
  raw: unknown;
  secrets: Record<string, string>;
}

/** Merchant identifiers that a provider echoes in its callback: [callback field, merchant_config key]. */
const ECHOED_MERCHANT_FIELDS: Record<string, Array<[string, string]>> = {
  payfast: [['merchant_id', 'merchant_id']],
  ozow: [['SiteCode', 'site_code']],
};

function field(raw: unknown, key: string): string | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Returns every reason this callback must not settle; an empty list means it is bound correctly. */
export function bindingProblems(input: BindingInput): string[] {
  const problems: string[] = [];
  const { intent, config } = input;
  if (!intent) return ['unknown_reference'];
  if (intent.provider !== input.provider) problems.push('provider_mismatch');
  if (intent.mode !== input.mode) problems.push('mode_mismatch');
  if (!config) {
    problems.push('no_gateway_config');
    return problems;
  }
  if (config.school_id !== intent.school_id) problems.push('config_school_mismatch');
  if (!config.enabled) problems.push('gateway_disabled');
  if (config.provider !== input.provider) problems.push('config_provider_mismatch');
  if (config.mode !== input.mode) problems.push('config_mode_mismatch');

  for (const [callbackField, configKey] of ECHOED_MERCHANT_FIELDS[input.provider] ?? []) {
    const expected = config.merchant_config?.[configKey];
    const received = field(input.raw, callbackField);
    if (!expected || !received || expected.trim() !== received.trim()) {
      problems.push(`merchant_mismatch:${callbackField}`);
    }
  }

  // PayFast's ITN signature is only a secret when a passphrase is set; in
  // live mode an unset passphrase would make the signature forgeable.
  if (input.provider === 'payfast' && input.mode === 'live' && !input.secrets.PAYFAST_PASSPHRASE) {
    problems.push('payfast_passphrase_required_in_live_mode');
  }
  return problems;
}
