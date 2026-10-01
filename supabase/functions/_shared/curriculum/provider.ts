// The model provider behind a small interface, so the pipeline can be tested with a stub and the provider
// swapped without touching governance code. The provider only ever returns text; it has no database access.

export interface DraftProvider {
  /** Short stable name, recorded on the generation request (e.g. "anthropic"). */
  readonly name: string;
  /** Exact model identifier, recorded on the generation request. */
  readonly model: string;
  generate(input: { system: string; user: string }): Promise<string>;
}

export class ProviderError extends Error {
  constructor(public readonly code: 'provider_unavailable' | 'provider_rejected' | 'provider_empty' | 'provider_timeout') {
    super(code);
  }
}

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  maxTokens?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/** Anthropic Messages API. Errors are reduced to a code: response bodies are never surfaced or stored. */
export function anthropicProvider(opts: AnthropicOptions): DraftProvider {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    name: 'anthropic',
    model: opts.model,
    async generate({ system, user }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90_000);
      let res: Response;
      try {
        res = await fetchFn('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': opts.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: opts.model,
            max_tokens: opts.maxTokens ?? 8000,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        });
      } catch (err) {
        throw new ProviderError((err as Error)?.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable');
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new ProviderError(res.status >= 500 ? 'provider_unavailable' : 'provider_rejected');
      let data: { content?: Array<{ type?: string; text?: string }> };
      try {
        data = await res.json();
      } catch {
        throw new ProviderError('provider_empty');
      }
      const text = (data.content ?? []).filter((c) => c.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('');
      if (!text.trim()) throw new ProviderError('provider_empty');
      return text;
    },
  };
}
