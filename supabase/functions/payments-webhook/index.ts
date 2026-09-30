// payments-webhook — the single inbound endpoint for every provider's
// server-to-server callback. Public (providers cannot present a Supabase
// JWT). Provider + mode come from the query string this function set as
// the notify_url in payments-initiate — which means they are attacker-
// controllable and are NEVER trusted on their own.
//
// This function NEVER decides on its own that a payment succeeded:
//   1. parse + verify the callback with the provider adapter;
//   2. load the intent the callback references and that school's gateway
//      configuration, re-verify with the school's merchant configuration,
//      and check the callback is bound to that intent (binding.ts: same
//      provider, same mode, enabled config, the school's own merchant);
//   3. hand everything to settle_payment_intent() (service_role, SECURITY
//      DEFINER), which dedupes, re-checks the amount, and books the payment.
// A callback that fails verification or binding is passed on with
// signatureValid=false, so it is recorded in payment_webhook_events (with the
// reasons) and never settles. It always responds 200 so the provider does
// not retry forever.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildContext, getAdapter, readProviderSecrets } from '../_shared/providers/index.ts';
import {
  bindingProblems,
  type GatewayConfigForBinding,
  type IntentForBinding,
} from '../_shared/providers/binding.ts';

const MERCHANT_VERIFIED_PROVIDERS = new Set(['netcash']);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? '';
  const mode = url.searchParams.get('mode') === 'test' ? 'test' : 'live';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  let adapter;
  try {
    adapter = getAdapter(provider);
  } catch {
    return new Response('unknown provider', { status: 200 });
  }

  try {
    // Pass 1: parse with environment secrets only, to learn the reference.
    const first = await adapter.parseWebhook(req.clone(), buildContext(provider, {}, mode));

    const { data: intent } = await admin
      .from('payment_intents')
      .select('school_id, provider, mode')
      .eq('reference', first.reference)
      .maybeSingle<IntentForBinding>();
    const { data: config } = intent
      ? await admin
        .from('payment_gateway_configs')
        .select('school_id, provider, mode, enabled, merchant_config')
        .eq('school_id', intent.school_id)
        .maybeSingle<GatewayConfigForBinding>()
      : { data: null };

    // Pass 2: adapters whose verification uses a per-school merchant value
    // (Netcash's service key) re-verify with that school's configuration.
    // Others verify with environment secrets only, so pass 1 stands and we
    // avoid a second round-trip to the provider (PayFast's validate call).
    const result = config && MERCHANT_VERIFIED_PROVIDERS.has(provider)
      ? await adapter.parseWebhook(
        req.clone(),
        buildContext(provider, (config.merchant_config ?? {}) as Record<string, string>, mode),
      )
      : first;

    const problems = bindingProblems({
      provider,
      mode,
      intent: intent ?? null,
      config: config ?? null,
      raw: result.raw,
      secrets: readProviderSecrets(provider),
    });
    const accepted = result.signatureValid && problems.length === 0;
    const rawPayload =
      (typeof result.raw === 'object' && result.raw !== null ? result.raw : { value: result.raw }) as Record<
        string,
        unknown
      >;

    const { data, error } = await admin.rpc('settle_payment_intent', {
      p_provider: provider,
      p_mode: mode,
      p_provider_event_id: result.providerEventId,
      p_reference: result.reference,
      p_provider_reference: result.providerReference,
      p_amount: result.amount,
      p_outcome: result.outcome,
      p_signature_valid: accepted,
      // The forensic record carries why a callback was refused.
      p_payload: problems.length > 0 ? { ...rawPayload, _funda360_binding_problems: problems } : rawPayload,
    });

    if (error) {
      console.error('settle_payment_intent error', error);
      return new Response('recorded', { status: 200 });
    }

    if (!accepted) {
      console.warn('webhook refused', provider, result.reference, {
        signatureValid: result.signatureValid,
        problems,
      });
    } else console.log('webhook processed', provider, result.reference, data);
    // PayFast specifically wants an empty 200.
    return new Response('', { status: 200 });
  } catch (err) {
    console.error('payments-webhook parse error', err);
    // Still 200 — a 5xx makes the provider hammer us. We just have nothing to record.
    return new Response('error', { status: 200 });
  }
});
