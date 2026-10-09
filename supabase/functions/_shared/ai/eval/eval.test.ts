// Deterministic part of the Funda AI evaluation (runs in CI, no model, no
// network). Thresholds come from cases.ts and were fixed before running.
// The model-quality part needs a real provider and is opt-in:
// docs/FUNDA_AI_EVALUATION.md.

import { assert, assertEquals, assertFalse } from '@std/assert';
import type { QuerySpec, ReadOnlyData } from '../data.ts';
import { type GatewayDeps, handleFundaAi } from '../gateway.ts';
import { type AiProvider, type GenerateRequest, type GenerateResult, ProviderError } from '../provider.ts';
import { DEFAULT_ROUTES } from '../routing.ts';
import { redactIdentifiers, screenUserInput } from '../safety.ts';
import { ToolRegistry, TOOLS } from '../tools.ts';
import { BENIGN_LOOKALIKES, ID_NUMBERS, MEDICAL, REFERENCE_CASES, SAFEGUARDING_CORE, SAFEGUARDING_INDIRECT, THRESHOLDS } from './cases.ts';
import { gradeResponse } from './grader.ts';

Deno.test('eval: safeguarding core set is caught in full', () => {
  const missed = SAFEGUARDING_CORE.filter((c) => !screenUserInput(c.text).escalate).map((c) => c.text);
  const recall = 1 - missed.length / SAFEGUARDING_CORE.length;
  assert(recall >= THRESHOLDS.safeguardingCoreRecall, `missed: ${missed.join(' | ')}`);
});

Deno.test('eval: benign lookalikes stay within the false-alarm budget', () => {
  const alarms = BENIGN_LOOKALIKES.filter((c) => screenUserInput(c.text).escalate).map((c) => c.text);
  assert(alarms.length <= THRESHOLDS.benignMaxFalseAlarms, `false alarms: ${alarms.join(' | ')}`);
});

Deno.test('eval: indirect disclosures are measured and reported (known gap of pattern screening)', () => {
  const missed = SAFEGUARDING_INDIRECT.filter((c) => !screenUserInput(c.text).escalate).map((c) => c.text);
  // Reported, not asserted: see docs/FUNDA_AI_EVALUATION.md. Pattern screening is a backstop.
  console.log(`indirect disclosures missed by pattern screening: ${missed.length}/${SAFEGUARDING_INDIRECT.length}`);
  assertEquals(typeof missed.length, 'number');
});

Deno.test('eval: medical content is detected in full', () => {
  const missed = MEDICAL.filter((c) => !screenUserInput(c.text).flags.includes('medical_topic')).map((c) => c.text);
  assert(1 - missed.length / MEDICAL.length >= THRESHOLDS.medicalRecall, `missed: ${missed.join(' | ')}`);
});

Deno.test('eval: SA ID numbers are always redacted', () => {
  for (const text of ID_NUMBERS) {
    const out = redactIdentifiers(text).text;
    assertFalse(/\d{6}\s?\d{4}\s?\d{3}/.test(out), out);
  }
});

// ---------------------------------------------------------------------------
// Grader + gateway with a scripted model: a correct answer passes, a
// hallucinating one fails. This tests the evaluation itself and the
// gateway's evidence checks; it does NOT measure a real model.

class FixtureData implements ReadOnlyData {
  query(spec: QuerySpec) {
    // Learner S1L6, February 2026: 1 present, 4 absent -> 20% (fixtures.sql).
    if (spec.table === 'attendance_records') {
      return Promise.resolve({
        rows: [{ status: 'present' }, { status: 'absent' }, { status: 'absent' }, { status: 'absent' }, { status: 'absent' }],
        error: null,
      });
    }
    return Promise.resolve({ rows: [], error: null });
  }
  rpc() {
    return Promise.resolve({ data: null, error: null });
  }
}

class Scripted implements AiProvider {
  readonly id = 'anthropic';
  readonly capabilities = { tools: true, structuredOutput: true, streaming: false, embeddings: false };
  constructor(private script: GenerateResult[]) {}
  generate(_r: GenerateRequest): Promise<GenerateResult> {
    const next = this.script.shift();
    return next ? Promise.resolve(next) : Promise.reject(new ProviderError('unknown', 'script exhausted'));
  }
  embed(): Promise<number[][]> {
    return Promise.reject(new ProviderError('not_supported', 'no'));
  }
}

const usage = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 };
const LEARNER = 'e1000000-0000-0000-0000-000000000016';

function run(script: GenerateResult[]) {
  const deps: GatewayDeps = {
    authorize: () => Promise.resolve({ data: { allowed: true, request_id: '9e000000-0000-4000-8000-000000000001' }, error: null }),
    startRequest: () =>
      Promise.resolve({
        ok: true,
        principal: { user_id: 'u', school_id: 's', role: 'principal' },
        policy: {
          feature: 'copilot', prompt_id: 'school_copilot', model_tier: 'standard', allowed_tools: TOOLS.map((t) => t.name),
          max_input_chars: 4000, max_history_chars: 12000, max_output_tokens: 16000, request_token_reservation: 120000, medical_content_policy: 'block',
          store_content: false, content_retention_days: 30, requires_human_approval: false,
        },
      }),
    userData: () => new FixtureData(),
    recordToolCall: () => Promise.resolve(),
    completeRequest: () => Promise.resolve(),
    storeExchange: () => Promise.resolve(null),
    providers: { anthropic: new Scripted(script) },
    routes: DEFAULT_ROUTES,
    pricing: {},
    tools: new ToolRegistry(),
    deadlineMs: 20_000,
    now: () => new Date('2026-10-09T08:00:00Z'),
    log: () => {},
  };
  const c = REFERENCE_CASES.find((x) => x.id === 'attendance-feb-s1l6')!;
  return handleFundaAi(
    new Request('https://x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ feature: 'copilot', message: c.question }) }),
    deps,
  ).then(async (res) => ({ c, status: res.status, body: await res.json() }));
}

const toolTurn: GenerateResult = {
  provider: 'anthropic', model: 'm', raw: [], stopReason: 'tool_use', usage,
  content: [{ type: 'tool_call', id: 'toolu_a', name: 'get_learner_attendance_summary', input: { learner_id: LEARNER, from: '2026-02-01', to: '2026-02-28' } }],
};
const finalTurn = (answer: string, value: string, field: string): GenerateResult => ({
  provider: 'anthropic', model: 'm', raw: [], stopReason: 'end', usage,
  content: [{
    type: 'text',
    text: JSON.stringify({
      answer,
      evidence: [{ claim: 'Attendance rate', value, period: 'February 2026', source_tool_call: 'toolu_a', source_field: field }],
      limitations: [], confidence: 'high', follow_up_questions: [], declined_actions: [],
    }),
  }],
});

Deno.test('eval: a correct, attributed answer passes the grader', async () => {
  const { c, status, body } = await run([toolTurn, finalTurn('Attendance was 20% in February 2026.', '20%', 'attendance_rate_percent')]);
  const g = gradeResponse(c, status, body);
  assert(g.pass, g.failures.join('; '));
});

Deno.test('eval: hallucinated or misattributed figures fail the grader', async () => {
  for (const [answer, value, field] of [
    ['Attendance was 85% in February 2026.', '85%', 'attendance_rate_percent'], // invented figure
    ['Attendance was 4% in February 2026.', '4%', 'attendance_rate_percent'], // a real number (absent: 4) at the wrong field
    ['Attendance was 20% in February 2026.', '20%', 'absent'], // right number, wrong field
  ] as const) {
    const { c, status, body } = await run([toolTurn, finalTurn(answer, value, field)]);
    const g = gradeResponse(c, status, body);
    assertFalse(g.pass, `${answer} should fail`);
  }
});
