// Adversarial evidence tests through the real gateway with a scripted model
// and stub tools (synthetic data, no network). Each case states what a user
// must (not) be shown. If a check in evidence.ts is removed, the matching
// case fails: every "withheld" case asserts both answer_withheld and the
// reported unsupported figure.
//
// This proves the number checks, not the truth of the answer's wording:
// see the header of evidence.ts.

import { assert, assertEquals, assertFalse } from '@std/assert';
import { type GatewayDeps, handleFundaAi } from '../gateway.ts';
import { type AiProvider, type GenerateRequest, type GenerateResult, ProviderError } from '../provider.ts';
import { DEFAULT_ROUTES } from '../routing.ts';
import { ToolRegistry } from '../tools.ts';

const FIND = {
  learners: [
    { learner_id: 'L1', name: 'Thabo Mokoena', learner_number: 'LRN-001', status: 'active' },
    { learner_id: 'L2', name: 'Sipho Dube', learner_number: 'LRN-002', status: 'active' },
  ],
  count: 2,
};
const FEB = {
  learner_id: 'L1',
  period_from: '2026-02-01',
  period_to: '2026-02-28',
  attendance_rate_percent: 85,
  absent: 4,
  overall_average_percent: 61,
  subjects: [
    { subject: 'Maths', average_percent: 58 },
    { subject: 'English', average_percent: 72 },
  ],
  outstanding_balance: '2050.00',
};
const MARCH = { learner_id: 'L1', period_from: '2026-03-01', period_to: '2026-03-31', attendance_rate_percent: 70 };

const stub = (name: string, result: unknown) => ({
  name,
  description: name,
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  allowedRoles: ['principal'],
  requiredCapability: 'can_view_academic',
  scope: 'learner',
  sensitive: false,
  run: () => Promise.resolve({ result, resultCount: 1 }),
});

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

interface Ev {
  value: string;
  field: string;
  claim: string;
  call?: string;
  period?: string;
}
interface Answer {
  answer: string;
  evidence?: Ev[];
  limitations?: string[];
  confidence?: 'low' | 'medium' | 'high';
}

// deno-lint-ignore no-explicit-any
async function ask(question: string, a: Answer): Promise<any> {
  const toolTurn: GenerateResult = {
    provider: 'anthropic', model: 'm', raw: [], stopReason: 'tool_use', usage,
    content: [
      { type: 'tool_call', id: 'toolu_f', name: 'find_stub', input: {} },
      { type: 'tool_call', id: 'toolu_d', name: 'feb_stub', input: {} },
      { type: 'tool_call', id: 'toolu_m', name: 'march_stub', input: {} },
    ],
  };
  const final: GenerateResult = {
    provider: 'anthropic', model: 'm', raw: [], stopReason: 'end', usage,
    content: [{
      type: 'text',
      text: JSON.stringify({
        answer: a.answer,
        evidence: (a.evidence ?? []).map((e) => ({
          claim: e.claim, value: e.value, period: e.period ?? '2026-02-01 to 2026-02-28',
          source_tool_call: e.call ?? 'toolu_d', source_field: e.field,
        })),
        limitations: a.limitations ?? [], confidence: a.confidence ?? 'high', follow_up_questions: [], declined_actions: [],
      }),
    }],
  };
  const deps: GatewayDeps = {
    authorize: () => Promise.resolve({ data: { allowed: true, request_id: '9e000000-0000-4000-8000-000000000001' }, error: null }),
    startRequest: () =>
      Promise.resolve({
        ok: true,
        principal: { user_id: 'u', school_id: 's', role: 'principal' },
        policy: {
          feature: 'copilot', prompt_id: 'school_copilot', model_tier: 'standard', allowed_tools: ['find_stub', 'feb_stub', 'march_stub'],
          max_input_chars: 4000, max_history_chars: 12000, max_output_tokens: 16000, request_token_reservation: 120000,
          medical_content_policy: 'block', store_content: false, content_retention_days: 30, requires_human_approval: false,
        },
      }),
    userData: () => ({ query: () => Promise.resolve({ rows: [], error: null }), rpc: () => Promise.resolve({ data: null, error: null }) }),
    recordToolCall: () => Promise.resolve(),
    completeRequest: () => Promise.resolve(),
    storeExchange: () => Promise.resolve(null),
    providers: { anthropic: new Scripted([toolTurn, final]) },
    routes: DEFAULT_ROUTES,
    pricing: {},
    // deno-lint-ignore no-explicit-any
    tools: new ToolRegistry([stub('find_stub', FIND), stub('feb_stub', FEB), stub('march_stub', MARCH)] as any),
    deadlineMs: 20_000,
    now: () => new Date('2026-10-09T08:00:00Z'),
    log: () => {},
  };
  const res = await handleFundaAi(
    new Request('https://x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ feature: 'copilot', message: question }) }),
    deps,
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.kind, 'answer');
  return body;
}

const Q = 'How is Thabo Mokoena doing?';
const ATT: Ev = { value: '85%', field: 'attendance_rate_percent', claim: 'Attendance rate' };

// deno-lint-ignore no-explicit-any
function withheld(body: any, figure: RegExp) {
  assert(body.answer_withheld, `expected withheld: ${JSON.stringify(body.unsupported_figures)}`);
  assert(
    (body.unsupported_figures as string[]).some((f) => figure.test(f)),
    `expected ${figure} in ${JSON.stringify(body.unsupported_figures)}`,
  );
  assertEquals(body.confidence, 'low');
}

Deno.test('evidence (adversarial): a correct, bound answer is shown', async () => {
  const body = await ask(Q, { answer: "Thabo Mokoena's attendance was 85% from 2026-02-01 to 2026-02-28.", evidence: [ATT] });
  assertFalse(body.answer_withheld, JSON.stringify(body.unsupported_figures));
  assert(body.evidence[0].verified);
  assertEquals(body.confidence, 'high');
});

Deno.test('evidence (adversarial): unsupported figures in any script or in words are withheld', async () => {
  for (const [answer, figure] of [
    ["Thabo's attendance was 87%.", /87%/],
    ["Thabo's attendance was ８７%.", /87%/],
    ["Thabo's attendance was ٨٧%.", /87%/],
    ["Thabo's attendance was eighty-seven percent.", /eighty-seven/],
    ['About a hundred learners were absent.', /a hundred/],
    ['Half of the class failed Maths.', /Half/],
  ] as const) {
    withheld(await ask(Q, { answer, evidence: [ATT] }), figure);
  }
});

Deno.test('evidence (adversarial): a verified number reused with another meaning is withheld', async () => {
  withheld(await ask(Q, { answer: 'Thabo failed 4 subjects.', evidence: [{ value: '4', field: 'absent', claim: 'Days absent' }] }), /^4 \(not what/);
});

Deno.test('evidence (adversarial): a list figure attributed to another row is withheld', async () => {
  const maths: Ev = { value: '58', field: 'subjects[0].average_percent', claim: 'Maths average' };
  withheld(await ask(Q, { answer: "Thabo's English average is 58%.", evidence: [maths] }), /58% \(not what/);
  const ok = await ask(Q, { answer: "Thabo's Maths average is 58%.", evidence: [maths] });
  assertFalse(ok.answer_withheld, JSON.stringify(ok.unsupported_figures));
});

Deno.test('evidence (adversarial): a learner figure attributed to a different learner is withheld', async () => {
  withheld(await ask(Q, { answer: "Sipho Dube's attendance was 85%.", evidence: [ATT] }), /85% \(not what/);
});

Deno.test('evidence (adversarial): a figure placed in the wrong reporting period is withheld', async () => {
  withheld(await ask(Q, { answer: "Thabo's attendance in March 2026 was 85%.", evidence: [ATT] }), /March 2026 \(outside/);
  // The evidence item's own period must fit the cited output.
  const body = await ask(Q, { answer: "Thabo's attendance was 85%.", evidence: [{ ...ATT, period: 'March 2026' }] });
  assertEquals(body.evidence[0].reason, 'unsupported_claim');
  assert(body.answer_withheld);
});

Deno.test('evidence (adversarial): conflicting evidence from two periods must keep each figure in its own period', async () => {
  const march: Ev = { value: '70%', field: 'attendance_rate_percent', claim: 'Attendance rate', call: 'toolu_m', period: '2026-03-01 to 2026-03-31' };
  const ok = await ask(Q, {
    answer: "Thabo's attendance was 85% from 2026-02-01 to 2026-02-28. His attendance was 70% from 2026-03-01 to 2026-03-31.",
    evidence: [ATT, march],
  });
  assertFalse(ok.answer_withheld, JSON.stringify(ok.unsupported_figures));
  withheld(await ask(Q, { answer: "Thabo's attendance was 70% from 2026-02-01 to 2026-02-28.", evidence: [march] }), /2026-02-01 \(outside/);
});

Deno.test('evidence (adversarial): ranges need both ends verified', async () => {
  const maths: Ev = { value: '58', field: 'subjects[0].average_percent', claim: 'Maths average' };
  const english: Ev = { value: '72', field: 'subjects[1].average_percent', claim: 'English average' };
  const ok = await ask(Q, { answer: "Thabo's subject averages ranged from 58% in Maths to 72% in English.", evidence: [maths, english] });
  assertFalse(ok.answer_withheld, JSON.stringify(ok.unsupported_figures));
  withheld(await ask(Q, { answer: "Thabo's subject averages ranged from 58% in Maths to 80% in English.", evidence: [maths, english] }), /80%/);
});

Deno.test('evidence (adversarial): rounded or converted values are withheld', async () => {
  const avg: Ev = { value: '61', field: 'overall_average_percent', claim: 'Overall average' };
  withheld(await ask(Q, { answer: "Thabo's overall average is about 60%.", evidence: [avg] }), /60%/);
  withheld(await ask(Q, { answer: "Thabo's overall average is 0.61.", evidence: [avg] }), /0\.61/);
});

Deno.test('evidence (adversarial): dates, labels and ordinals cannot smuggle numbers', async () => {
  for (const [answer, figure] of [
    ['As many as 17 may fail Maths.', /^17$/],
    ['By May 25 learners had dropped out.', /May 25/],
    ["Thabo's Maths grade 45% is worrying.", /45%/],
    ['Thabo was ranked 3rd in his class.', /^3$/],
    ['Fees have been owing since 1999.', /since 1999/],
    ['He was absent in week 52.', /week 52/],
  ] as const) {
    withheld(await ask(Q, { answer, evidence: [ATT] }), figure);
  }
});

Deno.test('evidence (adversarial): a statement about a person not in the data is withheld', async () => {
  withheld(await ask(Q, { answer: "Thabo's attendance was 85%, and Lerato was absent all week.", evidence: [ATT] }), /Lerato/);
});

Deno.test("evidence (adversarial): a claim cannot borrow the user's number; rejected claims are not shown", async () => {
  const body = await ask('Is his attendance 90%?', { answer: 'See the evidence.', evidence: [{ ...ATT, claim: 'Attendance is 90% as you said' }] });
  assertFalse(body.evidence[0].verified);
  assertEquals(body.evidence[0].reason, 'unsupported_claim');
  assertFalse(JSON.stringify(body.evidence).includes('90%'), 'rejected claim text must not be shown');
});

Deno.test('evidence (adversarial): wrong tool call or field path is rejected', async () => {
  const a = await ask(Q, { answer: "Thabo's attendance was 85%.", evidence: [{ ...ATT, call: 'toolu_zzz' }] });
  assertEquals(a.evidence[0].reason, 'unknown_tool_call');
  assert(a.answer_withheld);
  const b = await ask(Q, { answer: "Thabo's attendance was 85%.", evidence: [{ ...ATT, field: 'attendance' }] });
  assertEquals(b.evidence[0].reason, 'unknown_field');
  assert(b.answer_withheld);
});

Deno.test('evidence (adversarial): predictions keep confidence below high', async () => {
  const body = await ask(Q, { answer: "Thabo's attendance was 85%, so he will likely fail the year.", evidence: [ATT] });
  assertFalse(body.answer_withheld);
  assertEquals(body.confidence, 'medium');
});
