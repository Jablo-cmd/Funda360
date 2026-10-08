import { describe, expect, it } from 'vitest';
import {
  aiErrorMessage,
  buildHistory,
  GENERIC_AI_ERROR,
  parseAiResult,
  toolLabel,
} from '@/features/ai/utils/aiResponse';

const answer = {
  kind: 'answer',
  request_id: 'r1',
  answer: 'Text',
  evidence: [
    { claim: 'Rate', value: '90%', period: 'Term 3', source_tool_call: 't1', verified: true },
    { claim: 'Bad', value: 5 },
    { claim: 'Unverified', value: '1', period: 'p', source_tool_call: 't2', verified: 'yes' },
  ],
  limitations: ['L1', 3],
  confidence: 'certain',
  follow_up_questions: ['Q?'],
  declined_actions: [],
  tools_used: [{ tool: 'find_learners', status: 'ok' }, { tool: 1 }],
  requires_human_review: true,
};

describe('parseAiResult', () => {
  it('keeps only well-formed fields and treats unknown confidence as low', () => {
    const r = parseAiResult(answer);
    expect(r?.kind).toBe('answer');
    if (r?.kind !== 'answer') return;
    expect(r.evidence).toHaveLength(2);
    expect(r.evidence[1]?.verified).toBe(false);
    expect(r.limitations).toEqual(['L1']);
    expect(r.confidence).toBe('low');
    expect(r.toolsUsed).toEqual([{ tool: 'find_learners', status: 'ok' }]);
    expect(r.requiresHumanReview).toBe(true);
  });

  it('parses a safeguarding notice', () => {
    expect(
      parseAiResult({ kind: 'safeguarding', request_id: 'r2', message: 'Tell the DSL' }),
    ).toEqual({
      kind: 'safeguarding',
      requestId: 'r2',
      message: 'Tell the DSL',
    });
  });

  it('rejects anything else', () => {
    expect(parseAiResult(null)).toBeNull();
    expect(parseAiResult('text')).toBeNull();
    expect(parseAiResult({ kind: 'answer', answer: 'x' })).toBeNull();
    expect(parseAiResult({ kind: 'other', request_id: 'r' })).toBeNull();
  });
});

describe('buildHistory', () => {
  const turn = (q: string, a: string | null, kind: 'answer' | 'safeguarding' = 'answer') => ({
    question: q,
    result:
      a === null
        ? null
        : parseAiResult(
            kind === 'answer' ? { ...answer, answer: a } : { kind, request_id: 'r', message: a },
          ),
  });

  it('sends the last three answered pairs, oldest first, never safeguarding notices or failed turns', () => {
    const history = buildHistory([
      turn('q1', 'a1'),
      turn('q2', 'a2'),
      turn('q3', null),
      turn('q4', 'sg', 'safeguarding'),
      turn('q5', 'a5'),
      turn('q6', 'a6'),
    ]);
    expect(history).toEqual([
      { role: 'user', text: 'q2' },
      { role: 'assistant', text: 'a2' },
      { role: 'user', text: 'q5' },
      { role: 'assistant', text: 'a5' },
      { role: 'user', text: 'q6' },
      { role: 'assistant', text: 'a6' },
    ]);
  });

  it('caps each text at the gateway limit', () => {
    expect(buildHistory([turn('x'.repeat(5000), 'y')])[0]?.text).toHaveLength(4000);
  });
});

describe('messages', () => {
  it('maps gateway codes to plain language and falls back for unknown codes', () => {
    expect(aiErrorMessage('rate_limited')).toMatch(/Wait a minute/);
    expect(aiErrorMessage('ai_provider_not_configured')).toMatch(/not been connected/);
    expect(aiErrorMessage('something_new')).toBe(GENERIC_AI_ERROR);
    expect(aiErrorMessage(null)).toBe(GENERIC_AI_ERROR);
    expect(toolLabel('get_learner_fee_summary')).toBe('Fee account');
    expect(toolLabel('new_tool')).toBe('new tool');
  });
});
