// payments-webhook — the single inbound endpoint for every provider's
// server-to-server callback. Public (providers cannot present a Supabase
// JWT). Provider + mode come from the query string this function set as
// the notify_url in payments-initiate.
//
// This function NEVER decides on its own that a payment succeeded. It
// parses + verifies the callback with the provider adapter, then hands
// everything to settle_payment_intent() (service_role, SECURITY DEFINER),
// which dedupes, re-checks the amount, and books the payment. It always
// responds 200 so the provider does not retry forever — the forensic
// record lives in payment_webhook_events.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getAdapter, buildContext } from '../_shared/providers/index.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? '';
  const mode = (url.searchParams.get('mode') ?? 'live') as 'test' | 'live';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  let adapter;
  try {
    adapter = getAdapter(provider);
  } catch {
    return new Response('unknown provider', { status: 200 });
  }

  const ctx = buildContext(provider, {}, mode);

  try {
    const result = await adapter.parseWebhook(req.clone(), ctx);

    const { data, error } = await admin.rpc('settle_payment_intent', {
      p_provider: provider,
      p_mode: mode,
      p_provider_event_id: result.providerEventId,
      p_reference: result.reference,
      p_provider_reference: result.providerReference,
      p_amount: result.amount,
      p_outcome: result.outcome,
      p_signature_valid: result.signatureValid,
      p_payload: result.raw ?? {},
    });

    if (error) {
      console.error('settle_payment_intent error', error);
      return new Response('recorded', { status: 200 });
    }

    console.log('webhook processed', provider, result.reference, data);
    // PayFast specifically wants an empty 200.
    return new Response('', { status: 200 });
  } catch (err) {
    console.error('payments-webhook parse error', err);
    // Still 200 — a 5xx makes the provider hammer us. We just have nothing to record.
    return new Response('error', { status: 200 });
  }
});
