// Configuration-driven model selection. Business logic asks for a tier
// ("simple" | "standard" | "complex"); this module turns the tier into an
// ordered list of routes (primary first, then fallbacks used when a provider
// is unavailable). Operators override the defaults with the
// FUNDA_AI_MODEL_ROUTES environment variable (JSON, same shape as
// DEFAULT_ROUTES) without a code change.

import type { Effort } from './provider.ts';

export type ModelTier = 'simple' | 'standard' | 'complex';

export interface ModelRoute {
  provider: string;
  model: string;
  effort: Effort;
  /** Let the provider re-run a refused request on its recommended fallback model. */
  refusalFallback: boolean;
  timeoutMs: number;
}

export const TIERS: ModelTier[] = ['simple', 'standard', 'complex'];

// One model, three effort levels: lower effort for simple tasks before
// reaching for a different model (measure before introducing a cascade).
export const DEFAULT_ROUTES: Record<ModelTier, ModelRoute[]> = {
  simple: [{ provider: 'anthropic', model: 'claude-opus-5-5', effort: 'low', refusalFallback: true, timeoutMs: 45_000 }],
  standard: [{ provider: 'anthropic', model: 'claude-opus-5-5', effort: 'medium', refusalFallback: true, timeoutMs: 60_000 }],
  complex: [{ provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high', refusalFallback: true, timeoutMs: 90_000 }],
};

const EFFORTS: Effort[] = ['low', 'medium', 'high'];

function isRoute(value: unknown): value is ModelRoute {
  const r = value as ModelRoute;
  return (
    typeof r === 'object' && r !== null &&
    typeof r.provider === 'string' && /^[a-z][a-z0-9_-]{1,30}$/.test(r.provider) &&
    typeof r.model === 'string' && /^[A-Za-z0-9._:-]{2,100}$/.test(r.model) &&
    EFFORTS.includes(r.effort) &&
    typeof r.refusalFallback === 'boolean' &&
    Number.isInteger(r.timeoutMs) && r.timeoutMs >= 1_000 && r.timeoutMs <= 300_000
  );
}

/** Parses FUNDA_AI_MODEL_ROUTES; an invalid value falls back to the defaults (and is reported). */
export function resolveRoutes(raw: string | undefined): { routes: Record<ModelTier, ModelRoute[]>; error: string | null } {
  if (!raw) return { routes: DEFAULT_ROUTES, error: null };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const routes = { ...DEFAULT_ROUTES };
    for (const tier of TIERS) {
      if (parsed[tier] === undefined) continue;
      const list = parsed[tier];
      if (!Array.isArray(list) || list.length === 0 || list.length > 4 || !list.every(isRoute)) {
        return { routes: DEFAULT_ROUTES, error: `invalid routes for tier ${tier}` };
      }
      routes[tier] = list as ModelRoute[];
    }
    return { routes, error: null };
  } catch {
    return { routes: DEFAULT_ROUTES, error: 'FUNDA_AI_MODEL_ROUTES is not valid JSON' };
  }
}

export interface ModelPrice {
  /** Micro-units of the billing currency per million input tokens. */
  inputPerMillion: number;
  outputPerMillion: number;
}

/**
 * Optional prices (FUNDA_AI_PRICING, JSON: { "<model>": { "inputPerMillion": n, "outputPerMillion": n } }).
 * No prices are built in: cost is estimated only when an operator supplies them.
 */
export function resolvePricing(raw: string | undefined): Record<string, ModelPrice> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, ModelPrice>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, p]) => Number.isFinite(p?.inputPerMillion) && Number.isFinite(p?.outputPerMillion)),
    );
  } catch {
    return {};
  }
}

export function estimateCostMicros(price: ModelPrice | undefined, inputTokens: number, outputTokens: number): number | null {
  if (!price) return null;
  return Math.round((inputTokens * price.inputPerMillion + outputTokens * price.outputPerMillion) / 1_000_000);
}
