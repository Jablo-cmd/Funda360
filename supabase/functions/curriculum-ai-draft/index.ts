// curriculum-ai-draft — creates an AI-assisted DRAFT lesson pack for a platform administrator.
//
// It is deliberately not a service-role function. It forwards the caller's own JWT to the database, so every
// RPC (ai_begin_generation, ai_generation_context, ai_ingest_draft, ...) checks is_platform_admin() for that
// person and records them as the requester. The model's reply is parsed, checked against a strict schema,
// checked again in SQL, and stored as origin = 'ai_draft', status = 'draft'. Nothing is ever approved or
// published here; that stays with content_transition() and the gates in the database.
//
// POST { versionId, topicId, objectiveIds: uuid[], instruction?, language? }
//   200 { status: 'draft_created', requestId, lessonId, resourceIds, assessmentId }
//   200 { status: 'rejected_output', requestId, reasons }   the model's output was refused; nothing was written
//   200 { status: 'failed', requestId, reason }              provider or database fault; nothing was written
//   400 invalid_request | 401 unauthorized | 403 forbidden | 404 not_found | 429 rate_limited | 503 not_configured
// Raw model text, provider error bodies and database error text are never returned.
//
// Secrets (set with `supabase secrets set`, never committed): ANTHROPIC_API_KEY.
// Configuration: CURRICULUM_AI_MODEL (exact model identifier; there is intentionally no default).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { anthropicProvider } from '../_shared/curriculum/provider.ts';
import { type DraftRequest, type Rpc, runDraft } from '../_shared/curriculum/pipeline.ts';

const STATUS: Record<string, number> = {
  invalid_request: 400,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  request_failed: 500,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+/.test(auth)) return json({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('CURRICULUM_AI_MODEL');
  if (!apiKey || !model) return json({ error: 'not_configured' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  const request: DraftRequest = {
    versionId: String(body.versionId ?? ''),
    topicId: String(body.topicId ?? ''),
    objectiveIds: Array.isArray(body.objectiveIds) ? body.objectiveIds.map(String) : [],
    instruction: typeof body.instruction === 'string' ? body.instruction : null,
    language: typeof body.language === 'string' ? body.language : null,
  };

  // The user's JWT, not the service key: the database sees (and authorises) the actual administrator.
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const rpc: Rpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    return { data: data as never, error: error ? { message: error.message, code: error.code } : null };
  };

  try {
    const outcome = await runDraft({ rpc, provider: anthropicProvider({ apiKey, model }) }, request);
    if (outcome.status === 'refused') return json({ error: outcome.code }, STATUS[outcome.code] ?? 500);
    return json(outcome);
  } catch (err) {
    console.error('curriculum-ai-draft', (err as Error)?.name ?? 'error');
    return json({ error: 'request_failed' }, 500);
  }
});
