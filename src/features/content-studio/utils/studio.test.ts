import { describe, expect, it } from 'vitest';
import type { ContentProvenance } from '@/lib/database.types';
import {
  DRAFT_ERRORS,
  describeValidation,
  effectiveVerification,
  VERIFICATION_LABEL,
  workflowActions,
} from '@/features/content-studio/utils/studio';

const verification = (
  over: Partial<ContentProvenance['verification']> = {},
): Pick<ContentProvenance, 'verification'> => ({
  verification: {
    status: 'reviewed',
    recorded_status: 'reviewed',
    stale: false,
    set_at: null,
    note: null,
    ...over,
  },
});

describe('workflowActions', () => {
  it('offers only the moves the lifecycle allows, with one primary action per step', () => {
    expect(workflowActions('draft').map((a) => a.to)).toEqual(['review']);
    expect(workflowActions('review').map((a) => a.to)).toEqual(['approved', 'draft']);
    expect(workflowActions('approved').map((a) => a.to)).toEqual(['published']);
    expect(workflowActions('published').map((a) => a.to)).toEqual(['retired']);
    expect(workflowActions('retired')).toEqual([]);
    for (const status of ['draft', 'review', 'approved'] as const) {
      expect(workflowActions(status).filter((a) => a.primary)).toHaveLength(1);
    }
  });

  it('never offers to skip a step', () => {
    expect(workflowActions('draft').some((a) => a.to === 'published' || a.to === 'approved')).toBe(
      false,
    );
    expect(workflowActions('review').some((a) => a.to === 'published')).toBe(false);
  });
});

describe('effectiveVerification', () => {
  it('reports the recorded level when it still applies', () => {
    expect(effectiveVerification(verification()).label).toBe(VERIFICATION_LABEL.reviewed);
  });

  it('treats an edit after review as unverified and says so', () => {
    const v = effectiveVerification(verification({ stale: true }));
    expect(v.status).toBe('unverified');
    expect(v.stale).toBe(true);
    expect(v.label).toMatch(/needs review again/);
  });

  it('never claims curriculum alignment in any label', () => {
    for (const label of Object.values(VERIFICATION_LABEL))
      expect(label).not.toMatch(/caps|aligned|compliant/i);
  });
});

describe('describeValidation', () => {
  const base = {
    run_id: 'r',
    run_at: 'now',
    passed: true,
    stale: false,
    errors: 0,
    warnings: 0,
    info: 0,
    unacknowledged_warnings: 0,
  };
  it('describes each state in plain words', () => {
    expect(describeValidation(null)).toMatch(/not been run/);
    expect(describeValidation({ ...base, stale: true })).toMatch(/Run the checks again/);
    expect(describeValidation({ ...base, passed: false, errors: 1 })).toBe(
      '1 error to fix before this can be approved.',
    );
    expect(describeValidation({ ...base, passed: false, errors: 3 })).toMatch(/3 errors/);
    expect(describeValidation({ ...base, warnings: 2, unacknowledged_warnings: 2 })).toMatch(
      /2 warnings need/,
    );
    expect(describeValidation(base)).toMatch(/nothing left/);
  });
});

describe('DRAFT_ERRORS', () => {
  it('has copy for every code the Edge Function returns', () => {
    for (const code of [
      'not_configured',
      'forbidden',
      'rate_limited',
      'invalid_request',
      'not_found',
      'unauthorized',
      'request_failed',
    ]) {
      expect(DRAFT_ERRORS[code]).toBeTruthy();
    }
  });
});
