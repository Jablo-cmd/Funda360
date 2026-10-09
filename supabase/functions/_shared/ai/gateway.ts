// Funda AI gateway: the only path from a Funda360 user to a model.
//
//   browser --(user JWT)--> funda-ai Edge Function --> handleFundaAi()
//     1. ai_authorize_request() as the user: flags, role, school, input and
//        history sizes, rate limits, budget pre-check, under per-user and
//        per-school locks. Every decision is recorded in ai_requests.
//     2. ai_start_request() (service role): reserves budget for this request
//        and returns its policy. Single use.
//     3. Safety: every turn (message AND history) is screened. Safeguarding
//        signals end the request with fixed guidance; medical content is
//        blocked unless the feature allows it; SA ID numbers are redacted.
//        No model call happens for blocked or escalated requests.
//     4. Prompt from the code registry; model route from configuration.
//     5. Model <-> tool loop under ONE deadline for the whole request (all
//        turns and retries). Tools run as the user (RLS); their output is
//        passed back as labelled untrusted data.
//     6. Output validated against the prompt's schema; each evidence item is
//        checked at the exact field it cites; numbers in the answer that are
//        not verified evidence cause the answer to be withheld.
//     7. Settlement: usage, tool calls and outcome recorded (service role, no
//        content). If a provider call was cut off, usage is unknown and the
//        reservation stays charged. Content stored only if policy allows.
//
// The model never writes anything: there are no write tools.

import { corsHeaders } from '../cors.ts';
import type { ReadOnlyData } from './data.ts';
import {
  type CheckedEvidence,
  checkClaims,
  checkFigures,
  type Confidence,
  knownStringsIn,
  decideConfidence,
  type EvidenceItem,
  verifyEvidence,
} from './evidence.ts';
import { getActivePrompt, renderSystemPrompt } from './prompts.ts';
import { type AiMessage, type AiProvider, ProviderError, type Usage } from './provider.ts';
import { estimateCostMicros, type ModelPrice, type ModelRoute, type ModelTier } from './routing.ts';
import {
  containsInjection,
  MEDICAL_NOTICE,
  redactIdentifiers,
  SAFEGUARDING_GUIDANCE,
  type SafetyFlag,
  screenConversation,
  wrapToolResult,
} from './safety.ts';
import { type JsonSchema, validate } from './schema.ts';
import { type Principal, type ToolRegistry, type ToolStatus } from './tools.ts';

export { normaliseFigure, verifyEvidence } from './evidence.ts';

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_MODEL_TURNS = 5;
export const MAX_TOOL_CALLS = 8;
/** Below this, another model call cannot finish before the deadline. */
export const MIN_CALL_MS = 3_000;
/** Below this many reserved tokens left, no further model turn starts. */
export const MIN_TURN_TOKENS = 1_024;
/** The gateway retries a retryable provider error this many times (the SDK itself does not retry). */
export const PROVIDER_RETRIES = 1;
/** Free plan: 150 s worker wall clock; leave room to settle and reply. */
export const DEFAULT_DEADLINE_MS = 110_000;

export interface Policy {
  feature: string;
  prompt_id: string;
  model_tier: ModelTier;
  allowed_tools: string[];
  max_input_chars: number;
  max_history_chars: number;
  max_output_tokens: number;
  /** Tokens reserved for this request; the gateway stops before exceeding it. */
  request_token_reservation: number;
  medical_content_policy: 'block' | 'allow';
  store_content: boolean;
  content_retention_days: number;
  requires_human_approval: boolean;
}

/** What ai_authorize_request returns to its caller: no policy details. */
export interface Authorization {
  allowed: boolean;
  reason?: string;
  request_id?: string;
}

/** What ai_start_request (service role) returns. */
export interface StartResult {
  ok: boolean;
  reason?: string;
  principal?: { user_id: string; school_id: string | null; role: string };
  policy?: Policy;
}

export interface Completion {
  status: 'succeeded' | 'failed' | 'safety_escalated' | 'policy_blocked';
  provider: string | null;
  model: string | null;
  promptId: string | null;
  promptVersion: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  durationMs: number;
  safetyFlags: string[];
  errorCode: string | null;
  /** A provider call was cut off: the provider may have billed tokens we never saw. */
  usageUnknown: boolean;
}

export interface GatewayDeps {
  /** Calls ai_authorize_request as the user. */
  authorize(
    jwt: string,
    feature: string,
    inputChars: number,
    historyChars: number,
    clientRequestId: string | null,
  ): Promise<{ data: Authorization | null; error: { status?: number; code?: string } | null }>;
  /** Calls ai_start_request with the service role. */
  startRequest(requestId: string): Promise<StartResult>;
  /** Read-only data access as the user. */
  userData(jwt: string): ReadOnlyData;
  /** Service-role audit writes. */
  recordToolCall(requestId: string, tool: string, status: ToolStatus, durationMs: number, resultCount: number, errorCode: string | null): Promise<void>;
  completeRequest(requestId: string, completion: Completion): Promise<void>;
  storeExchange(requestId: string, conversationId: string | null, userText: string, assistantText: string, structured: unknown): Promise<string | null>;
  providers: Record<string, AiProvider>;
  routes: Record<ModelTier, ModelRoute[]>;
  pricing: Record<string, ModelPrice>;
  tools: ToolRegistry;
  /** Total time allowed for one request, all model turns and retries included. */
  deadlineMs: number;
  now(): Date;
  log(event: Record<string, unknown>): void;
}

const BODY_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['feature', 'message'],
  properties: {
    feature: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,39}$' },
    message: { type: 'string', minLength: 1, maxLength: 8000 },
    history: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'text'],
        properties: { role: { type: 'string', enum: ['user', 'assistant'] }, text: { type: 'string', minLength: 1, maxLength: 4000 } },
      },
    },
    conversation_id: { type: 'string', format: 'uuid' },
    client_request_id: { type: 'string', pattern: '^[A-Za-z0-9._:-]{8,64}$' },
  },
};

interface Body {
  feature: string;
  message: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  conversation_id?: string;
  client_request_id?: string;
}

interface ModelAnswer {
  answer: string;
  evidence: EvidenceItem[];
  limitations: string[];
  confidence: Confidence;
  follow_up_questions: string[];
  declined_actions: string[];
}

const REASON_STATUS: Record<string, number> = {
  not_authenticated: 401,
  profile_inactive: 403,
  feature_disabled: 403,
  role_not_allowed: 403,
  school_context_required: 403,
  school_not_enabled: 403,
  input_too_large: 413,
  rate_limited: 429,
  budget_exhausted: 429,
};

const PROVIDER_STATUS: Record<string, { status: number; code: string }> = {
  timeout: { status: 504, code: 'ai_timeout' },
  rate_limited: { status: 503, code: 'ai_busy' },
  unavailable: { status: 503, code: 'ai_unavailable' },
  authentication: { status: 503, code: 'ai_provider_misconfigured' },
  not_configured: { status: 503, code: 'ai_provider_not_configured' },
  bad_request: { status: 502, code: 'ai_request_rejected' },
  not_supported: { status: 502, code: 'ai_request_rejected' },
  unknown: { status: 502, code: 'ai_failed' },
};

/** Provider errors after which the provider may still have billed the call. */
const USAGE_UNKNOWN_KINDS = new Set(['timeout', 'unavailable', 'unknown']);

export const WITHHELD_ANSWER =
  'Funda AI\'s answer included figures that could not be matched to your Funda360 data, so it is not shown. The figures that were checked are listed below.';

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function johannesburgDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export async function handleFundaAi(req: Request, deps: GatewayDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const started = Date.now();
  const deadlineAt = started + deps.deadlineMs;

  const auth = req.headers.get('authorization') ?? '';
  const jwt = /^Bearer\s+(\S+)$/i.exec(auth)?.[1];
  if (!jwt) return reply({ error: 'not_authenticated' }, 401);

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reply({ error: 'payload_too_large' }, 413);
  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ error: 'invalid_json' }, 400);
  }
  const bodyErrors = validate(BODY_SCHEMA, body);
  if (bodyErrors.length > 0) return reply({ error: 'invalid_request', details: bodyErrors.slice(0, 5) }, 400);
  const history = body.history ?? [];
  // Turns must alternate and end with the assistant, so the new message follows a reply.
  if (history.some((h, i) => h.role !== (i % 2 === 0 ? 'user' : 'assistant')) || history.length % 2 !== 0) {
    return reply({ error: 'invalid_request', details: ['$.history: turns must alternate user/assistant'] }, 400);
  }

  // The new message and the history have separate allowances.
  const historyChars = history.reduce((n, h) => n + h.text.length, 0);

  // 1. Policy gate, as the user.
  const { data: decision, error: authError } = await deps.authorize(
    jwt,
    body.feature,
    body.message.length,
    historyChars,
    body.client_request_id ?? null,
  );
  if (authError || !decision) {
    if (authError?.status === 401 || authError?.code === 'PGRST301') return reply({ error: 'not_authenticated' }, 401);
    deps.log({ event: 'funda_ai.policy_unavailable', code: authError?.code ?? null });
    return reply({ error: 'ai_policy_unavailable' }, 503);
  }
  if (!decision.allowed || !decision.request_id) {
    const reason = decision.reason ?? 'feature_disabled';
    deps.log({ event: 'funda_ai.blocked', feature: body.feature, reason, request_id: decision.request_id ?? null });
    return reply({ error: reason, request_id: decision.request_id ?? null }, REASON_STATUS[reason] ?? 403);
  }
  const requestId = decision.request_id;

  // 2. Reserve budget and load the policy (service role).
  let start: StartResult;
  try {
    start = await deps.startRequest(requestId);
  } catch {
    deps.log({ event: 'funda_ai.start_failed', request_id: requestId });
    return reply({ error: 'ai_policy_unavailable', request_id: requestId }, 503);
  }
  if (!start.ok || !start.policy || !start.principal) {
    const reason = start.reason === 'budget_exhausted' ? 'budget_exhausted' : 'ai_unavailable';
    deps.log({ event: 'funda_ai.blocked', feature: body.feature, reason, request_id: requestId });
    return reply({ error: reason, request_id: requestId }, reason === 'budget_exhausted' ? 429 : 503);
  }

  const policy = start.policy;
  const principal: Principal = { userId: start.principal.user_id, schoolId: start.principal.school_id, role: start.principal.role };
  const flags = new Set<SafetyFlag>();
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let served: { provider: string; model: string } | null = null;
  let usageUnknown = false;
  const prompt = getActivePrompt(policy.prompt_id);
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), Math.max(0, deadlineAt - Date.now()));

  const finish = async (status: Completion['status'], errorCode: string | null) => {
    const price = served ? deps.pricing[served.model] : undefined;
    const completion: Completion = {
      status,
      provider: served?.provider ?? null,
      model: served?.model ?? null,
      promptId: prompt?.id ?? policy.prompt_id,
      promptVersion: prompt?.version ?? null,
      inputTokens: served ? usage.inputTokens : null,
      outputTokens: served ? usage.outputTokens : null,
      costMicros: served ? estimateCostMicros(price, usage.inputTokens, usage.outputTokens) : null,
      durationMs: Date.now() - started,
      safetyFlags: [...flags],
      errorCode,
      usageUnknown,
    };
    try {
      await deps.completeRequest(requestId, completion);
    } catch {
      // The stale-request sweep closes it later, keeping the reservation charged.
      deps.log({ event: 'funda_ai.audit_write_failed', request_id: requestId });
    }
    // Telemetry: identifiers, counts and codes only; never content.
    deps.log({
      event: 'funda_ai.request',
      request_id: requestId,
      feature: policy.feature,
      role: principal.role,
      status,
      error_code: errorCode,
      provider: completion.provider,
      model: completion.model,
      prompt_version: completion.promptVersion,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
      usage_unknown: usageUnknown,
      duration_ms: completion.durationMs,
      safety_flags: completion.safetyFlags,
    });
  };

  try {
    // 3. Safety: every turn, before anything leaves Funda360.
    const screen = screenConversation(
      [body.message, ...history.filter((h) => h.role === 'user').map((h) => h.text)],
      history.filter((h) => h.role === 'assistant').map((h) => h.text),
    );
    screen.flags.forEach((f) => flags.add(f));
    if (screen.escalate) {
      await finish('safety_escalated', `safeguarding_${screen.escalate}`);
      return reply({ kind: 'safeguarding', request_id: requestId, message: SAFEGUARDING_GUIDANCE[screen.escalate] });
    }
    if (flags.has('medical_topic') && policy.medical_content_policy !== 'allow') {
      await finish('policy_blocked', 'medical_content_blocked');
      return reply({ kind: 'policy_notice', request_id: requestId, message: MEDICAL_NOTICE });
    }
    let redactions = 0;
    const redact = (text: string) => {
      const r = redactIdentifiers(text);
      redactions += r.count;
      return r.text;
    };
    const message = redact(body.message);
    const turns = history.map((h) => ({ role: h.role, text: redact(h.text) }));
    if (redactions > 0) flags.add('personal_identifier_redacted');

    // 4. Prompt and route.
    if (!prompt) {
      await finish('failed', 'prompt_not_found');
      return reply({ error: 'ai_unavailable', request_id: requestId }, 503);
    }
    const routes = (deps.routes[policy.model_tier] ?? []).filter((r) => deps.providers[r.provider]);
    if (routes.length === 0) {
      await finish('failed', 'provider_not_configured');
      return reply({ error: 'ai_provider_not_configured', request_id: requestId }, 503);
    }

    const tools = deps.tools.available(policy.allowed_tools, principal.role);
    const today = johannesburgDate(deps.now());
    const system = renderSystemPrompt(prompt, {
      role: principal.role.replace(/_/g, ' '),
      school_context: principal.schoolId ? 'the user\'s own school (data is limited to what this user may see)' : 'no school',
      today,
      tools: tools.length > 0 ? tools.map((t) => t.name).join(', ') : 'none',
    });

    const messages: AiMessage[] = turns.map((h) => ({ role: h.role, content: [{ type: 'text', text: h.text }] }));
    messages.push({ role: 'user', content: [{ type: 'text', text: message }] });

    const toolCtx = { data: deps.userData(jwt), principal, today };
    const toolOutputs = new Map<string, unknown>();
    const toolsUsed: { tool: string; status: ToolStatus }[] = [];
    let routeIndex = 0;

    const deadlineExceeded = async () => {
      await finish('failed', 'deadline_exceeded');
      return reply({ error: 'ai_timeout', request_id: requestId }, 504);
    };

    // 5. Model <-> tool loop, under one deadline and within the reservation.
    let retriesLeft = PROVIDER_RETRIES;
    for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
      const remaining = deadlineAt - Date.now();
      if (remaining < MIN_CALL_MS || deadline.signal.aborted) return await deadlineExceeded();
      // The next call's input is at least everything sent so far; never let
      // output push the request past what was reserved for it.
      const tokensLeft = policy.request_token_reservation - (usage.inputTokens + usage.outputTokens);
      // (A feature with a small output cap may run turns smaller than MIN_TURN_TOKENS.)
      if (tokensLeft < Math.min(MIN_TURN_TOKENS, policy.max_output_tokens)) {
        await finish('failed', 'reservation_exhausted');
        return reply({ error: 'ai_incomplete', request_id: requestId }, 502);
      }
      const route = routes[routeIndex];
      let result;
      try {
        result = await deps.providers[route.provider].generate({
          model: route.model,
          system,
          messages,
          tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
          outputSchema: prompt.outputSchema,
          maxOutputTokens: Math.min(policy.max_output_tokens, tokensLeft),
          effort: route.effort,
          refusalFallback: route.refusalFallback,
          timeoutMs: Math.min(route.timeoutMs, remaining),
          signal: deadline.signal,
        });
      } catch (error) {
        const pe = error instanceof ProviderError ? error : new ProviderError('unknown', 'provider call failed');
        if (USAGE_UNKNOWN_KINDS.has(pe.kind)) usageUnknown = true;
        if (deadline.signal.aborted) return await deadlineExceeded();
        // One retry of the same call for transient errors (the SDK does not
        // retry, so every attempt is visible here and billed attempts are
        // reflected in usageUnknown).
        if (pe.retryable && retriesLeft > 0 && deadlineAt - Date.now() >= MIN_CALL_MS) {
          retriesLeft -= 1;
          turn -= 1;
          deps.log({ event: 'funda_ai.provider_retry', request_id: requestId, kind: pe.kind });
          continue;
        }
        // Fall back to the next route only before the conversation is bound to a provider.
        if (turn === 0 && pe.retryable && routeIndex + 1 < routes.length) {
          routeIndex += 1;
          turn -= 1;
          deps.log({ event: 'funda_ai.route_fallback', request_id: requestId, from: route.model, kind: pe.kind });
          continue;
        }
        const mapped = PROVIDER_STATUS[pe.kind] ?? PROVIDER_STATUS.unknown;
        await finish('failed', `provider_${pe.kind}`);
        return reply({ error: mapped.code, request_id: requestId }, mapped.status);
      }

      served = { provider: result.provider, model: result.model };
      usage = {
        inputTokens: usage.inputTokens + result.usage.inputTokens,
        outputTokens: usage.outputTokens + result.usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens + result.usage.cacheReadTokens,
      };

      if (result.stopReason === 'refusal') {
        await finish('failed', 'model_declined');
        return reply({ error: 'ai_declined', request_id: requestId }, 422);
      }
      if (result.stopReason === 'max_tokens') {
        await finish('failed', 'output_truncated');
        return reply({ error: 'ai_output_incomplete', request_id: requestId }, 502);
      }

      const calls = result.content.filter((b) => b.type === 'tool_call');
      if (result.stopReason === 'tool_use' && calls.length > 0) {
        messages.push({ role: 'assistant', content: result.content, providerRaw: result.raw });
        const results: AiMessage['content'] = [];
        for (const call of calls) {
          if (call.type !== 'tool_call') continue;
          if (deadline.signal.aborted) return await deadlineExceeded();
          if (toolsUsed.length >= MAX_TOOL_CALLS) {
            results.push({ type: 'tool_result', toolCallId: call.id, content: wrapToolResult(call.id, call.name, { error: 'tool_call_limit_reached' }), isError: true });
            continue;
          }
          const execution = await deps.tools.execute(call.name, call.input, policy.allowed_tools, toolCtx);
          toolsUsed.push({ tool: call.name, status: execution.status });
          try {
            await deps.recordToolCall(requestId, call.name, execution.status, execution.durationMs, execution.resultCount, execution.errorCode);
          } catch {
            deps.log({ event: 'funda_ai.audit_write_failed', request_id: requestId });
          }
          if (execution.status === 'ok' || execution.status === 'empty') {
            toolOutputs.set(call.id, execution.payload);
            if (containsInjection(execution.payload)) flags.add('injection_in_tool_data');
          }
          results.push({
            type: 'tool_result',
            toolCallId: call.id,
            content: wrapToolResult(call.id, call.name, execution.payload),
            isError: execution.status !== 'ok' && execution.status !== 'empty',
          });
        }
        messages.push({ role: 'user', content: results });
        continue;
      }

      // 6. Final answer.
      const text = result.content.filter((b) => b.type === 'text').map((b) => (b.type === 'text' ? b.text : '')).join('');
      let answer: ModelAnswer;
      try {
        answer = JSON.parse(text);
      } catch {
        await finish('failed', 'invalid_model_output');
        return reply({ error: 'ai_invalid_output', request_id: requestId }, 502);
      }
      if (validate(prompt.outputSchema, answer).length > 0) {
        await finish('failed', 'invalid_model_output');
        return reply({ error: 'ai_invalid_output', request_id: requestId }, 502);
      }

      const known = knownStringsIn(toolOutputs.values());
      const evidence: CheckedEvidence[] = checkClaims(verifyEvidence(answer.evidence, toolOutputs), message, known);
      const figures = checkFigures(answer.answer, message, evidence, known);
      const unsupported = [...figures.unsupported];
      const withheld = unsupported.length > 0;
      // Notes shown under the answer get the same check; items with unchecked numbers are dropped.
      let droppedNotes = 0;
      const keepChecked = (items: string[]) =>
        items.filter((item) => {
          const c = checkFigures(item, message, evidence, known);
          if (c.unsupported.length === 0) return true;
          droppedNotes += 1;
          unsupported.push(...c.unsupported);
          return false;
        });
      const modelLimitations = keepChecked(answer.limitations);
      const followUps = keepChecked(answer.follow_up_questions);
      const declined = keepChecked(answer.declined_actions);
      const toolsReturnedData = toolsUsed.some((t) => t.status === 'ok');
      const confidence = decideConfidence({
        model: answer.confidence,
        evidence,
        toolsReturnedData,
        unsupported: unsupported.length,
        userOnly: figures.userOnly.length,
      });
      const limitations = [...modelLimitations];
      if (figures.userOnly.length > 0) {
        limitations.push(`These figures come from your question and were not checked against Funda360 data: ${figures.userOnly.join(', ')}.`);
      }
      if (droppedNotes > 0) {
        limitations.push('Some notes contained figures that could not be checked and were removed.');
      }
      if (evidence.some((e) => !e.verified)) {
        limitations.push('Some figures did not match the Funda360 data they cited and are marked as rejected. Do not rely on them.');
      }
      if (toolsReturnedData && !evidence.some((e) => e.verified)) {
        limitations.push('No figure in this answer could be checked against your Funda360 data.');
      }
      if (unsupported.length > 0) flags.add('unsupported_figures');
      const answerText = withheld ? WITHHELD_ANSWER : answer.answer;
      const response = {
        kind: 'answer',
        request_id: requestId,
        conversation_id: null as string | null,
        answer: answerText,
        answer_withheld: withheld,
        unsupported_figures: [...new Set(unsupported)].slice(0, 10),
        unchecked_user_figures: figures.userOnly,
        evidence,
        limitations,
        confidence,
        follow_up_questions: followUps,
        declined_actions: declined,
        tools_used: toolsUsed,
        requires_human_review: policy.requires_human_approval,
        generated_by: { provider: result.provider, model: result.model, prompt: prompt.id, prompt_version: prompt.version },
      };

      // 7. Settle; store content only when the policy allows it.
      await finish('succeeded', withheld ? 'answer_withheld' : null);
      if (policy.store_content) {
        try {
          response.conversation_id = await deps.storeExchange(requestId, body.conversation_id ?? null, message, answerText, {
            evidence,
            limitations,
            confidence,
            answer_withheld: withheld,
          });
        } catch {
          deps.log({ event: 'funda_ai.store_failed', request_id: requestId });
        }
      }
      return reply(response);
    }

    await finish('failed', 'tool_loop_limit');
    return reply({ error: 'ai_incomplete', request_id: requestId }, 502);
  } catch {
    await finish('failed', 'internal_error');
    return reply({ error: 'internal_error', request_id: requestId }, 500);
  } finally {
    clearTimeout(timer);
  }
}
