// Orchestration of one AI draft: request -> context -> model -> strict schema check -> database ingest.
// Every database step is an RPC executed as the signed-in platform administrator (their JWT), so the same
// authorization, tenant and lifecycle rules apply as for a person. This module never sees a service key.

import { extractJson, validateDraft } from './schema.ts';
import { buildPrompt, type GenerationContext, PROMPT_VERSION } from './prompt.ts';
import { type DraftProvider, ProviderError } from './provider.ts';

export interface RpcResult<T = unknown> {
  data: T | null;
  error: { message?: string; code?: string } | null;
}
export type Rpc = <T = unknown>(name: string, args: Record<string, unknown>) => Promise<RpcResult<T>>;

export interface DraftRequest {
  versionId: string;
  topicId: string;
  objectiveIds: string[];
  instruction?: string | null;
  language?: string | null;
}

export type DraftOutcome =
  | { status: 'draft_created'; requestId: string; lessonId: string; resourceIds: string[]; assessmentId: string | null }
  | { status: 'rejected_output'; requestId: string; reasons: string[] }
  | { status: 'failed'; requestId: string; reason: string }
  | { status: 'refused'; code: 'not_found' | 'invalid_request' | 'forbidden' | 'rate_limited' | 'request_failed' };

/** The stable codes a database error is reduced to. Raw database text never leaves this module. */
export function refusal(err: { message?: string; code?: string } | null): Extract<DraftOutcome, { status: 'refused' }> {
  const m = err?.message ?? '';
  if (/^insufficient_privilege\b/.test(m)) return { status: 'refused', code: 'forbidden' };
  if (/^rate_limited\b/.test(m)) return { status: 'refused', code: 'rate_limited' };
  if (/^not_found\b/.test(m)) return { status: 'refused', code: 'not_found' };
  if (/^(invalid_argument|invalid_state|invalid_reference)\b/.test(m) || /^(22|23)/.test(err?.code ?? '')) {
    return { status: 'refused', code: 'invalid_request' };
  }
  return { status: 'refused', code: 'request_failed' };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidRequest(r: DraftRequest): boolean {
  return (
    UUID.test(r.versionId) && UUID.test(r.topicId) && Array.isArray(r.objectiveIds) &&
    r.objectiveIds.length >= 1 && r.objectiveIds.length <= 8 && r.objectiveIds.every((id) => typeof id === 'string' && UUID.test(id)) &&
    (r.instruction == null || (typeof r.instruction === 'string' && r.instruction.length <= 2000)) &&
    (r.language == null || /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(r.language))
  );
}

export async function runDraft(deps: { rpc: Rpc; provider: DraftProvider }, req: DraftRequest): Promise<DraftOutcome> {
  const { rpc, provider } = deps;
  if (!isValidRequest(req)) return { status: 'refused', code: 'invalid_request' };

  const begun = await rpc<string>('ai_begin_generation', {
    p_version_id: req.versionId,
    p_topic_id: req.topicId,
    p_objective_ids: req.objectiveIds,
    p_instruction: req.instruction ?? null,
    p_language: req.language ?? 'en',
    p_provider: provider.name,
    p_model: provider.model,
    p_prompt_version: PROMPT_VERSION,
    p_params: {},
  });
  if (begun.error || typeof begun.data !== 'string') return refusal(begun.error);
  const requestId = begun.data;

  const fail = async (status: 'failed' | 'rejected_output', reasons: string[]) => {
    const r = await rpc('ai_fail_generation', { p_request_id: requestId, p_status: status, p_reasons: reasons });
    if (r.error) console.error('curriculum-ai-draft: could not record failure', requestId, r.error.code ?? '');
  };

  // The prompt is built from what the database says about this request, never from client-supplied text.
  const ctx = await rpc<GenerationContext>('ai_generation_context', { p_request_id: requestId });
  if (ctx.error || !ctx.data) {
    await fail('failed', ['context_unavailable']);
    return { status: 'failed', requestId, reason: 'context_unavailable' };
  }

  let text: string;
  try {
    text = await provider.generate(buildPrompt(ctx.data));
  } catch (err) {
    const code = err instanceof ProviderError ? err.code : 'provider_unavailable';
    await fail('failed', [code]);
    return { status: 'failed', requestId, reason: code };
  }

  const parsed = extractJson(text);
  if (!parsed.ok) {
    await fail('rejected_output', [parsed.problem]);
    return { status: 'rejected_output', requestId, reasons: [parsed.problem] };
  }
  const checked = validateDraft(parsed.value, ctx.data.objectives.map((o) => o.code));
  if (!checked.ok) {
    await fail('rejected_output', checked.problems);
    return { status: 'rejected_output', requestId, reasons: checked.problems };
  }

  const ingested = await rpc<{ ok: boolean; status: string; reasons?: string[]; lesson_id?: string; resource_ids?: string[]; assessment_id?: string | null }>(
    'ai_ingest_draft',
    { p_request_id: requestId, p_payload: checked.value },
  );
  if (ingested.error || !ingested.data) {
    await fail('failed', ['ingest_unavailable']);
    return { status: 'failed', requestId, reason: 'ingest_unavailable' };
  }
  if (!ingested.data.ok || !ingested.data.lesson_id) {
    // The database re-validated the output and refused it; it has already recorded the rejection.
    return { status: 'rejected_output', requestId, reasons: ingested.data.reasons ?? ['rejected'] };
  }
  return {
    status: 'draft_created',
    requestId,
    lessonId: ingested.data.lesson_id,
    resourceIds: ingested.data.resource_ids ?? [],
    assessmentId: ingested.data.assessment_id ?? null,
  };
}
