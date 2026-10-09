import type {
  AiConfidence,
  AiEvidence,
  AiHistoryTurn,
  AiResult,
  AiToolUse,
} from '@/features/ai/types/ai.types';

/** User-facing text for each error code the funda-ai gateway returns. */
const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: 'Your session has expired. Sign in again to use Funda AI.',
  profile_inactive: 'Your account is not active.',
  feature_disabled: 'Funda AI is not switched on for your account.',
  role_not_allowed: 'Funda AI is not available for your role yet.',
  school_context_required: 'Funda AI needs an active school.',
  school_not_enabled: 'Funda AI is not switched on for your school.',
  input_too_large: 'That question is too long. Shorten it and try again.',
  payload_too_large: 'That question is too long. Shorten it and try again.',
  rate_limited: 'You have asked a lot of questions in a short time. Wait a minute and try again.',
  budget_exhausted: "The Funda AI allowance for this month (yours or your school's) has been used.",
  ai_provider_not_configured:
    'Funda AI has not been connected to an AI provider yet. Your administrator can set this up.',
  ai_provider_misconfigured:
    'Funda AI is temporarily unavailable. Your administrator has been notified in the logs.',
  ai_unavailable: 'Funda AI is temporarily unavailable. Try again shortly.',
  ai_busy: 'Funda AI is busy. Try again in a moment.',
  ai_timeout: 'Funda AI took too long to answer. Try a narrower question.',
  ai_declined: 'Funda AI cannot help with that request.',
  ai_invalid_output: 'Funda AI could not produce a reliable answer. Try rephrasing the question.',
  ai_output_incomplete: 'The answer was too long to complete. Try a narrower question.',
  ai_incomplete: 'Funda AI could not finish looking this up. Try a narrower question.',
  ai_policy_unavailable: 'Funda AI is temporarily unavailable. Try again shortly.',
};

export const GENERIC_AI_ERROR = 'Funda AI could not answer right now. Try again shortly.';

export function aiErrorMessage(code: string | null | undefined): string {
  return (code && ERROR_MESSAGES[code]) || GENERIC_AI_ERROR;
}

/** Plain-language names for the lookups shown under an answer. */
const TOOL_LABELS: Record<string, string> = {
  find_learners: 'Learner search',
  get_learner_attendance_summary: 'Attendance summary',
  get_learner_assessment_summary: 'Assessment results',
  get_learner_fee_summary: 'Fee account',
  get_reporting_summary: 'School reporting summary',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool.replace(/_/g, ' ');
}

const isString = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isString) : []);

/** Validates the gateway's JSON before it is rendered; anything unexpected becomes null. */
export function parseAiResult(raw: unknown): AiResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.request_id)) return null;
  if ((r.kind === 'safeguarding' || r.kind === 'policy_notice') && isString(r.message)) {
    return { kind: r.kind, requestId: r.request_id, message: r.message };
  }
  if (r.kind !== 'answer' || !isString(r.answer)) return null;
  const confidence: AiConfidence =
    r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : 'low';
  const evidence: AiEvidence[] = (Array.isArray(r.evidence) ? r.evidence : []).flatMap((e) => {
    const item = e as Record<string, unknown>;
    if (!isString(item.claim) || !isString(item.value)) return [];
    return [
      {
        claim: item.claim,
        value: item.value,
        period: isString(item.period) ? item.period : '',
        sourceToolCall: isString(item.source_tool_call) ? item.source_tool_call : '',
        sourceField: isString(item.source_field) ? item.source_field : '',
        verified: item.verified === true,
      },
    ];
  });
  const toolsUsed: AiToolUse[] = (Array.isArray(r.tools_used) ? r.tools_used : []).flatMap((t) => {
    const item = t as Record<string, unknown>;
    return isString(item.tool) && isString(item.status)
      ? [{ tool: item.tool, status: item.status }]
      : [];
  });
  return {
    kind: 'answer',
    requestId: r.request_id,
    answer: r.answer,
    evidence,
    limitations: strings(r.limitations),
    confidence,
    followUpQuestions: strings(r.follow_up_questions),
    declinedActions: strings(r.declined_actions),
    toolsUsed,
    requiresHumanReview: r.requires_human_review === true,
    answerWithheld: r.answer_withheld === true,
    unsupportedFigures: strings(r.unsupported_figures),
  };
}

/**
 * Longest text replayed per history turn. Three pairs stay well inside the
 * gateway's history allowance (ai_features.max_history_chars, 12,000 by
 * default), so a follow-up after a long answer is never refused for size.
 */
export const HISTORY_TURN_CHARS = 1500;

/**
 * The previous turns sent with a new question: at most the last three
 * question/answer pairs, oldest first, always starting with a question.
 * Only answer text is sent back (no evidence or data), each turn trimmed to
 * HISTORY_TURN_CHARS. Safeguarding and policy notices, and answers that were
 * withheld for unverified figures, are never replayed.
 */
export function buildHistory(
  turns: { question: string; result: AiResult | null }[],
  maxPairs = 3,
): AiHistoryTurn[] {
  return turns
    .filter(
      (t): t is { question: string; result: Extract<AiResult, { kind: 'answer' }> } =>
        t.result?.kind === 'answer' && !t.result.answerWithheld,
    )
    .slice(-maxPairs)
    .flatMap((t) => [
      { role: 'user' as const, text: trimAtBoundary(t.question, HISTORY_TURN_CHARS) },
      { role: 'assistant' as const, text: trimAtBoundary(t.result.answer, HISTORY_TURN_CHARS) },
    ]);
}

/**
 * Shortens text to at most `max` characters at a whitespace boundary, so a
 * long number (e.g. an ID the gateway would redact) is never cut into a
 * fragment that no longer looks like one, and no surrogate pair is split.
 */
export function trimAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.search(/\s\S*$/);
  return (
    space > 0 ? cut.slice(0, space) : cut.slice(0, max).replace(/[\uD800-\uDBFF]$/, '')
  ).trimEnd();
}
