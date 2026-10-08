// Funda AI gateway: the only path from a Funda360 user to a model.
//
//   browser --(user JWT)--> funda-ai Edge Function --> handleFundaAi()
//     1. ai_authorize_request() as the user: flags, role, school, limits,
//        budget. Every decision is recorded in ai_requests.
//     2. Safety screen. Safeguarding signals end the request with fixed
//        guidance; no model call.
//     3. Prompt from the code registry; model route from configuration.
//     4. Model <-> tool loop. Tools run as the user (RLS) and their output is
//        passed back as labelled untrusted data.
//     5. Output validated against the prompt's schema; evidence figures are
//        checked against the tool outputs they cite.
//     6. Usage, tool calls and outcome recorded (service role, no content);
//        content stored only if the feature's policy allows it.
//
// The model never writes anything: there are no write tools.

import { corsHeaders } from '../cors.ts';
import type { ReadOnlyData } from './data.ts';
import { getActivePrompt, renderSystemPrompt } from './prompts.ts';
import { type AiMessage, type AiProvider, ProviderError, type Usage } from './provider.ts';
import { estimateCostMicros, type ModelPrice, type ModelRoute, type ModelTier } from './routing.ts';
import { containsInjection, SAFEGUARDING_GUIDANCE, type SafetyFlag, screenUserInput, wrapToolResult } from './safety.ts';
import { type JsonSchema, validate } from './schema.ts';
import { type Principal, type ToolRegistry, type ToolStatus } from './tools.ts';

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_MODEL_TURNS = 5;
export const MAX_TOOL_CALLS = 8;

export interface Policy {
  feature: string;
  prompt_id: string;
  model_tier: ModelTier;
  allowed_tools: string[];
  max_input_chars: number;
  max_output_tokens: number;
  store_content: boolean;
  content_retention_days: number;
  requires_human_approval: boolean;
}

export interface Authorization {
  allowed: boolean;
  reason?: string;
  request_id?: string;
  principal?: { user_id: string; school_id: string | null; role: string };
  policy?: Policy;
}

export interface Completion {
  status: 'succeeded' | 'failed' | 'safety_escalated';
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
}

export interface GatewayDeps {
  /** Calls ai_authorize_request as the user. */
  authorize(jwt: string, feature: string, inputChars: number, clientRequestId: string | null): Promise<{ data: Authorization | null; error: { status?: number; code?: string } | null }>;
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

interface EvidenceItem {
  claim: string;
  value: string;
  period: string;
  source_tool_call: string;
}

interface ModelAnswer {
  answer: string;
  evidence: EvidenceItem[];
  limitations: string[];
  confidence: 'low' | 'medium' | 'high';
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

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Comparable form of a figure: "R 1 234,50" / "1234.5" / "85%" -> "1234.5" / "85". */
export function normaliseFigure(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== 'string') return null;
  const stripped = value.trim().replace(/^R\s*/i, '').replace(/%$/, '').replace(/[\s ]/g, '');
  const numeric = stripped.replace(/,(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return String(Number(numeric));
  return value.trim().toLowerCase();
}

function collectFigures(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) value.forEach((v) => collectFigures(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectFigures(v, out));
  else {
    const n = normaliseFigure(value);
    if (n !== null) out.add(n);
  }
}

/** Marks each evidence item verified when its value appears in the output of the tool call it cites. */
export function verifyEvidence(evidence: EvidenceItem[], toolOutputs: Map<string, unknown>) {
  return evidence.map((item) => {
    const output = toolOutputs.get(item.source_tool_call);
    if (output === undefined) return { ...item, verified: false };
    const figures = new Set<string>();
    collectFigures(output, figures);
    const value = normaliseFigure(item.value);
    return { ...item, verified: value !== null && figures.has(value) };
  });
}

function johannesburgDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export async function handleFundaAi(req: Request, deps: GatewayDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

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

  const started = Date.now();
  const inputChars = body.message.length + history.reduce((n, h) => n + h.text.length, 0);

  // 1. Policy gate, as the user.
  const { data: decision, error: authError } = await deps.authorize(jwt, body.feature, inputChars, body.client_request_id ?? null);
  if (authError || !decision) {
    if (authError?.status === 401 || authError?.code === 'PGRST301') return reply({ error: 'not_authenticated' }, 401);
    deps.log({ event: 'funda_ai.policy_unavailable', code: authError?.code ?? null });
    return reply({ error: 'ai_policy_unavailable' }, 503);
  }
  if (!decision.allowed || !decision.policy || !decision.principal || !decision.request_id) {
    const reason = decision.reason ?? 'feature_disabled';
    deps.log({ event: 'funda_ai.blocked', feature: body.feature, reason, request_id: decision.request_id ?? null });
    return reply({ error: reason, request_id: decision.request_id ?? null }, REASON_STATUS[reason] ?? 403);
  }

  const requestId = decision.request_id;
  const policy = decision.policy;
  const principal: Principal = { userId: decision.principal.user_id, schoolId: decision.principal.school_id, role: decision.principal.role };
  const flags = new Set<SafetyFlag>();
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let served: { provider: string; model: string } | null = null;
  const prompt = getActivePrompt(policy.prompt_id);

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
    };
    try {
      await deps.completeRequest(requestId, completion);
    } catch {
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
      duration_ms: completion.durationMs,
      safety_flags: completion.safetyFlags,
    });
  };

  try {
    // 2. Safety screen.
    const screen = screenUserInput(body.message);
    screen.flags.forEach((f) => flags.add(f));
    if (screen.escalate) {
      await finish('safety_escalated', `safeguarding_${screen.escalate}`);
      return reply({
        kind: 'safeguarding',
        request_id: requestId,
        message: SAFEGUARDING_GUIDANCE[screen.escalate],
      });
    }

    // 3. Prompt and route.
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

    const messages: AiMessage[] = history.map((h) => ({ role: h.role, content: [{ type: 'text', text: h.text }] }));
    messages.push({ role: 'user', content: [{ type: 'text', text: body.message }] });

    const toolCtx = { data: deps.userData(jwt), principal, today };
    const toolOutputs = new Map<string, unknown>();
    const toolsUsed: { tool: string; status: ToolStatus }[] = [];
    let routeIndex = 0;

    // 4. Model <-> tool loop.
    for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
      const route = routes[routeIndex];
      let result;
      try {
        result = await deps.providers[route.provider].generate({
          model: route.model,
          system,
          messages,
          tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
          outputSchema: prompt.outputSchema,
          maxOutputTokens: policy.max_output_tokens,
          effort: route.effort,
          refusalFallback: route.refusalFallback,
          timeoutMs: route.timeoutMs,
        });
      } catch (error) {
        const pe = error instanceof ProviderError ? error : new ProviderError('unknown', 'provider call failed');
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

      // 5. Final answer.
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

      const evidence = verifyEvidence(answer.evidence, toolOutputs);
      const limitations = [...answer.limitations];
      if (evidence.some((e) => !e.verified)) {
        limitations.push('Some figures could not be matched to the Funda360 data returned for this question. Check them before relying on them.');
      }
      const response = {
        kind: 'answer',
        request_id: requestId,
        conversation_id: null as string | null,
        answer: answer.answer,
        evidence,
        limitations,
        confidence: evidence.some((e) => !e.verified) ? 'low' : answer.confidence,
        follow_up_questions: answer.follow_up_questions,
        declined_actions: answer.declined_actions,
        tools_used: toolsUsed,
        requires_human_review: policy.requires_human_approval,
        generated_by: { provider: result.provider, model: result.model, prompt: prompt.id, prompt_version: prompt.version },
      };

      // 6. Record; store content only when the policy allows it.
      await finish('succeeded', null);
      if (policy.store_content) {
        try {
          response.conversation_id = await deps.storeExchange(requestId, body.conversation_id ?? null, body.message, answer.answer, {
            evidence,
            limitations,
            confidence: response.confidence,
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
  }
}
