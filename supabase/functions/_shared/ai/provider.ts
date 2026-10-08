// Provider-agnostic model interface. The gateway only ever talks to this;
// each vendor lives in its own adapter (anthropic.ts today). Adding a
// provider means implementing AiProvider and registering it in routing.

import type { JsonSchema } from './schema.ts';

export type AiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolCallId: string; content: string; isError?: boolean };

export interface AiMessage {
  role: 'user' | 'assistant';
  content: AiContentBlock[];
  /**
   * The provider's own representation of an assistant turn, replayed
   * unchanged on the next request in a tool loop (some providers attach
   * reasoning blocks that must be passed back exactly).
   */
  providerRaw?: unknown;
}

export interface AiToolSpec {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export type Effort = 'low' | 'medium' | 'high';

export interface GenerateRequest {
  model: string;
  system: string;
  messages: AiMessage[];
  tools: AiToolSpec[];
  /** When set, the final answer must be JSON matching this schema. */
  outputSchema?: JsonSchema;
  maxOutputTokens: number;
  effort?: Effort;
  /** Ask the provider to retry a refused request on its recommended fallback model. */
  refusalFallback?: boolean;
  timeoutMs: number;
}

export type StopReason = 'end' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface GenerateResult {
  provider: string;
  /** The model that actually served the request (may differ after a fallback). */
  model: string;
  content: AiContentBlock[];
  raw: unknown;
  stopReason: StopReason;
  usage: Usage;
}

export type ProviderErrorKind =
  | 'not_configured'
  | 'timeout'
  | 'rate_limited'
  | 'unavailable'
  | 'bad_request'
  | 'authentication'
  | 'not_supported'
  | 'unknown';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ProviderCapabilities {
  tools: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  embeddings: boolean;
}

export interface AiProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  /** Embeddings for retrieval. Providers without an embeddings API throw ProviderError('not_supported'). */
  embed(texts: string[], model: string): Promise<number[][]>;
}
