// Claude (Anthropic Messages API) adapter, through the official SDK.
//
// * Effort is set explicitly per route; thinking is left to the model's
//   default (adaptive on current models).
// * Tools are offered with tool_choice auto; structured final answers use
//   output_config.format (json_schema).
// * Refused requests are re-run by the API on Anthropic's recommended
//   fallback model when the route enables it (fallbacks: "default").
// * The SDK applies the per-call timeout but does not retry: the gateway
//   retries once and accounts for every attempt. The deadline signal aborts
//   the call.
// * The assistant turn is kept verbatim (raw) so a tool loop replays it
//   unchanged, as the API requires for reasoning blocks.

import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';
import { providerSchema } from './schema.ts';
import {
  type AiContentBlock,
  type AiMessage,
  type AiProvider,
  type GenerateRequest,
  type GenerateResult,
  ProviderError,
  type StopReason,
} from './provider.ts';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

function toAnthropicMessages(messages: AiMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.providerRaw !== undefined) {
      return { role: 'assistant', content: message.providerRaw };
    }
    return {
      role: message.role,
      content: message.content.map((block) => {
        switch (block.type) {
          case 'text':
            return { type: 'text', text: block.text };
          case 'tool_call':
            return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
          case 'tool_result':
            return { type: 'tool_result', tool_use_id: block.toolCallId, content: block.content, is_error: block.isError ?? false };
        }
      }),
    };
  });
}

function stopReasonOf(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end';
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    default:
      return 'other';
  }
}

/** Maps SDK errors to provider-neutral kinds; the message never carries request content. */
export function mapAnthropicError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  // Must precede the APIError checks: it is a subclass.
  if (error instanceof Anthropic.APIUserAbortError) return new ProviderError('timeout', 'The request deadline passed.', false);
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('timeout', 'The AI provider timed out.', true);
  if (error instanceof Anthropic.RateLimitError) return new ProviderError('rate_limited', 'The AI provider is rate limiting requests.', true);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError('authentication', 'The AI provider rejected the credentials.');
  }
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.UnprocessableEntityError) {
    return new ProviderError('bad_request', 'The AI provider rejected the request.');
  }
  if (error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) {
    return new ProviderError('unavailable', 'The AI provider is unavailable.', true);
  }
  if (error instanceof Anthropic.APIError) {
    const status = (error as { status?: number }).status ?? 0;
    return status >= 500
      ? new ProviderError('unavailable', 'The AI provider is unavailable.', true)
      : new ProviderError('bad_request', 'The AI provider rejected the request.');
  }
  return new ProviderError('unknown', 'The AI provider call failed.');
}

export function createAnthropicProvider(apiKey: string, options: { maxRetries?: number; baseURL?: string } = {}): AiProvider {
  // No SDK retries: the gateway retries once itself, so every attempt (and
  // the chance that a failed attempt was billed) is visible to accounting.
  const client = new Anthropic({ apiKey, maxRetries: options.maxRetries ?? 0, baseURL: options.baseURL });

  return {
    id: 'anthropic',
    capabilities: { tools: true, structuredOutput: true, streaming: false, embeddings: false },

    async generate(request: GenerateRequest): Promise<GenerateResult> {
      const outputConfig: Record<string, unknown> = {};
      if (request.effort) outputConfig.effort = request.effort;
      if (request.outputSchema) outputConfig.format = { type: 'json_schema', schema: providerSchema(request.outputSchema) };

      const params: Record<string, unknown> = {
        model: request.model,
        max_tokens: request.maxOutputTokens,
        // Stable system prompt first so it can be cached across requests.
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: toAnthropicMessages(request.messages),
        output_config: outputConfig,
      };
      if (request.tools.length > 0) {
        params.tools = request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: providerSchema(tool.inputSchema),
        }));
      }
      if (request.refusalFallback) {
        params.betas = [FALLBACK_BETA];
        params.fallbacks = 'default';
      }

      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create(
          params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming,
          { timeout: request.timeoutMs, signal: request.signal },
        );
      } catch (error) {
        throw mapAnthropicError(error);
      }

      const content: AiContentBlock[] = [];
      for (const block of response.content) {
        if (block.type === 'text') content.push({ type: 'text', text: block.text });
        else if (block.type === 'tool_use') content.push({ type: 'tool_call', id: block.id, name: block.name, input: block.input });
      }
      return {
        provider: 'anthropic',
        model: response.model,
        content,
        raw: response.content,
        stopReason: stopReasonOf(response.stop_reason),
        usage: usageOf(response.usage),
      };
    },

    embed(): Promise<number[][]> {
      return Promise.reject(new ProviderError('not_supported', 'This provider has no embeddings API; configure an embeddings provider.'));
    },
  };
}

type UsageCounts = Record<string, unknown>;

/**
 * Tokens for the whole call. With a server-side refusal fallback, top-level
 * `usage` covers only the attempt that produced the returned message;
 * `usage.iterations` lists every attempt (the refused one included), so it is
 * summed when present. Without it the top level is the only attempt.
 */
export function usageOf(raw: unknown): { inputTokens: number; outputTokens: number; cacheReadTokens: number } {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  const one = (u: UsageCounts) => ({
    inputTokens: n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens),
    outputTokens: n(u.output_tokens),
    cacheReadTokens: n(u.cache_read_input_tokens),
  });
  const usage = (raw ?? {}) as UsageCounts;
  const iterations = Array.isArray(usage.iterations) ? (usage.iterations as UsageCounts[]).filter((i) => i && typeof i === 'object') : [];
  if (iterations.length === 0) return one(usage);
  const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  for (const it of iterations) {
    const u = one(it);
    total.inputTokens += u.inputTokens;
    total.outputTokens += u.outputTokens;
    total.cacheReadTokens += u.cacheReadTokens;
  }
  // Never report less than the top level (in case iterations omit a field).
  const top = one(usage);
  return {
    inputTokens: Math.max(total.inputTokens, top.inputTokens),
    outputTokens: Math.max(total.outputTokens, top.outputTokens),
    cacheReadTokens: Math.max(total.cacheReadTokens, top.cacheReadTokens),
  };
}
