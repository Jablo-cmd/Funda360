// payments-initiate — turns a payment_intents row into a provider redirect.
//
// Auth: the caller's Supabase JWT is forwarded by supabase.functions.invoke.
// The intent is loaded with that JWT so RLS enforces "your own child's
// intent only". The gateway config (which guardians cannot read) is loaded
// with the service-role key, server-side. Provider secrets come from this
// function's own environment and never leave it.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getAdapter, buildContext } from '../_shared/providers/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let intentId: string;
  try {
    ({ intentId } = await req.json());
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!intentId) return json({ error: 'intentId required' }, 400);

  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: intent, error } = await asUser
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();
  if (error || !intent) return json({ error: 'not_found' }, 404);
  if (intent.status !== 'created' && intent.status !== 'processing') {
    return json({ error: 'intent_not_pending' }, 409);
  }

  const asService = createClient(supabaseUrl, serviceKey);
  const { data: config } = await asService
    .from('payment_gateway_configs')
    .select('*')
    .eq('school_id', intent.school_id)
    .maybeSingle();
  if (!config || !config.enabled) return json({ error: 'gateway_unavailable' }, 409);

  const { data: learner } = await asService
    .from('learners')
    .select('first_name, last_name')
    .eq('id', intent.learner_id)
    .maybeSingle();
  const learnerName = learner ? `${learner.first_name} ${learner.last_name}` : 'Learner';

  const adapter = getAdapter(config.provider);
  const ctx = buildContext(config.provider, (config.merchant_config ?? {}) as Record<string, string>, config.mode);
  const notifyUrl = `${supabaseUrl}/functions/v1/payments-webhook?provider=${config.provider}&mode=${config.mode}`;

  try {
    const redirect = await adapter.buildRedirect(
      {
        reference: intent.reference,
        amount: Number(intent.amount),
        currency: intent.currency,
        returnUrl: `${intent.return_url ?? ''}?intent=${intent.id}`,
        cancelUrl: `${intent.cancel_url ?? ''}?intent=${intent.id}`,
        notifyUrl,
        itemName: `School fees — ${learnerName}`,
        itemDescription: intent.invoice_id ? `Invoice payment` : `Account payment`,
      },
      ctx,
    );

    await asService
      .from('payment_intents')
      .update({ raw_request: { provider: config.provider, redirect: { method: redirect.method, url: redirect.url } } })
      .eq('id', intent.id);

    return json(redirect);
  } catch (err) {
    console.error('payments-initiate error', err);
    return json({ error: 'initiation_failed', detail: String(err) }, 502);
  }
});
