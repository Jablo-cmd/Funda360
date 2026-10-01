import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { curriculumErrorMessage } from '@/features/learning/utils/errors';

describe('curriculumErrorMessage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the hand-written sentence from an RPC rejection, as a sentence', () => {
    expect(
      curriculumErrorMessage(
        {
          message:
            'invalid_state: every validation warning must be acknowledged by a reviewer first',
          code: 'P0001',
        },
        'fallback',
      ),
    ).toBe('Every validation warning must be acknowledged by a reviewer first.');
    expect(
      curriculumErrorMessage(
        {
          message: 'insufficient_privilege: only platform administrators set verification',
          code: '42501',
        },
        'x',
      ),
    ).toBe('Only platform administrators set verification.');
  });

  it('never says "invitation" for a curriculum rejection', () => {
    expect(
      curriculumErrorMessage(
        { message: 'invalid_state: this school has not adopted the curriculum', code: 'P0001' },
        'x',
      ),
    ).not.toMatch(/invitation/i);
  });

  it('removes ids from the sentence', () => {
    const msg = curriculumErrorMessage(
      {
        message: 'invalid_reference: unknown source 11111111-1111-4111-8111-111111111111 here',
        code: 'P0001',
      },
      'x',
    );
    expect(msg).toBe('Unknown source here.');
  });

  it('keeps not_found generic', () => {
    expect(
      curriculumErrorMessage(
        { message: 'not_found: no lesson 11111111-1111-4111-8111-111111111111', code: 'P0002' },
        'x',
      ),
    ).toBe('That item could not be found.');
  });

  it('never leaks raw database text: unknown errors fall through to the app-wide translation', () => {
    const msg = curriculumErrorMessage(
      {
        message:
          'duplicate key value violates unique constraint "content_source_references_entity_table_entity_id_source_id_locator_key"',
        code: '23505',
      },
      'x',
    );
    expect(msg).toBe('This already exists — please check for a duplicate entry.');
    expect(
      curriculumErrorMessage(
        { message: 'relation "x" does not exist', code: '42P01' },
        'Something went wrong',
      ),
    ).toBe('Something went wrong');
  });
});
