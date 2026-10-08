// funda-ai — the Funda AI gateway (see docs/FUNDA_AI.md).
//
// Deployed WITH JWT verification: only signed-in Funda360 users reach it.
// * Policy decisions and data reads run with the caller's JWT, so the
//   database's RLS and the ai_authorize_request() policy apply.
// * The service-role key is used only for the audit RPCs
//   (ai_record_tool_call, ai_complete_request, ai_store_exchange), which are
//   executable by the service role alone.
// * The model provider key (ANTHROPIC_API_KEY) never leaves this function.
//   Without it the gateway answers 503 ai_provider_not_configured.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createAnthropicProvider } from '../_shared/ai/anthropic.ts';
import { userScopedData } from '../_shared/ai/data.ts';
import { handleFundaAi } from '../_shared/ai/gateway.ts';
import type { AiProvider } from '../_shared/ai/provider.ts';
import { resolvePricing, resolveRoutes } from '../_shared/ai/routing.ts';
import { ToolRegistry } from '../_shared/ai/tools.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(supabaseUrl, serviceKey, clientOptions);
const asUser = (jwt: string) =>
  createClient(supabaseUrl, anonKey, { ...clientOptions, global: { headers: { Authorization: `Bearer ${jwt}` } } });

const providers: Record<string, AiProvider> = {};
if (anthropicKey) providers.anthropic = createAnthropicProvider(anthropicKey);

const { routes, error: routeError } = resolveRoutes(Deno.env.get('FUNDA_AI_MODEL_ROUTES'));
if (routeError) console.error(JSON.stringify({ event: 'funda_ai.config_error', error: routeError }));
const pricing = resolvePricing(Deno.env.get('FUNDA_AI_PRICING'));
const tools = new ToolRegistry();

async function serviceRpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await service.rpc(fn, args);
  if (error) throw new Error(`${fn} failed`);
  return data;
}

Deno.serve((req) =>
  handleFundaAi(req, {
    async authorize(jwt, feature, inputChars, clientRequestId) {
      const { data, error, status } = await asUser(jwt).rpc('ai_authorize_request', {
        p_feature: feature,
        p_input_chars: inputChars,
        p_client_request_id: clientRequestId,
      });
      return { data, error: error ? { status, code: error.code } : null };
    },
    userData: (jwt) => userScopedData(asUser(jwt)),
    async recordToolCall(requestId, tool, status, durationMs, resultCount, errorCode) {
      await serviceRpc('ai_record_tool_call', {
        p_request_id: requestId,
        p_tool: tool,
        p_status: status,
        p_duration_ms: durationMs,
        p_result_count: resultCount,
        p_error_code: errorCode,
      });
    },
    async completeRequest(requestId, c) {
      await serviceRpc('ai_complete_request', {
        p_request_id: requestId,
        p_status: c.status,
        p_provider: c.provider,
        p_model: c.model,
        p_prompt_id: c.promptId,
        p_prompt_version: c.promptVersion,
        p_input_tokens: c.inputTokens,
        p_output_tokens: c.outputTokens,
        p_estimated_cost_micros: c.costMicros,
        p_duration_ms: c.durationMs,
        p_safety_flags: c.safetyFlags,
        p_error_code: c.errorCode,
      });
    },
    async storeExchange(requestId, conversationId, userText, assistantText, structured) {
      return (await serviceRpc('ai_store_exchange', {
        p_request_id: requestId,
        p_conversation_id: conversationId,
        p_user_text: userText,
        p_assistant_text: assistantText,
        p_structured: structured,
      })) as string | null;
    },
    providers,
    routes,
    pricing,
    tools,
    now: () => new Date(),
    log: (event) => console.log(JSON.stringify(event)),
  })
);
