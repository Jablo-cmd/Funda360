import { describe, expect, it } from 'vitest';
import type { ContentProvenance } from '@/lib/database.types';
import {
  curriculumVerification,
  DRAFT_ERRORS,
  describeValidation,
  effectiveVerification,
  SOURCE_LEVEL_LABEL,
  sourceEvidenceLevel,
  sourceEvidenceSteps,
  VERIFICATION_LABEL,
  workflowActions,
} from '@/features/content-studio/utils/studio';
import type { CurriculumSourceRow } from '@/lib/database.types';

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

const source = (over: Partial<CurriculumSourceRow> = {}): CurriculumSourceRow => ({
  id: 's',
  title: 'Doc',
  publisher: 'P',
  doc_type: 'other',
  url: null,
  edition: null,
  licence: 'L',
  excerpts_permitted: false,
  checksum_sha256: null,
  retrieved_on: null,
  status: 'registered',
  note: null,
  verified_at: null,
  created_at: '2026-10-01T00:00:00Z',
  indexed_on: null,
  content_reviewed_at: null,
  content_review_note: null,
  jurisdiction: null,
  subject: null,
  grade_phase: null,
  alternate_urls: [],
  isbn: null,
  licence_status: 'unreviewed',
  licence_reviewed_at: null,
  licence_review_note: null,
  retrieval_status: 'not_attempted',
  retrieval_size_bytes: null,
  retrieval_content_type: null,
  retrieval_final_url: null,
  retrieval_redirects: null,
  retrieval_recorded_at: null,
  ...over,
});

describe('sourceEvidenceLevel', () => {
  it('climbs one step at a time, and each step needs its own evidence', () => {
    expect(sourceEvidenceLevel(source())).toBe('registered');
    expect(sourceEvidenceLevel(source({ indexed_on: '2026-10-01' }))).toBe('indexed');
    expect(
      sourceEvidenceLevel(
        source({
          indexed_on: '2026-10-01',
          checksum_sha256: 'a'.repeat(64),
          retrieved_on: '2026-10-02',
        }),
      ),
    ).toBe('retrieved');
    expect(
      sourceEvidenceLevel(
        source({ status: 'verified', checksum_sha256: 'a'.repeat(64), retrieved_on: '2026-10-02' }),
      ),
    ).toBe('identity_verified');
    expect(
      sourceEvidenceLevel(
        source({
          status: 'verified',
          checksum_sha256: 'a'.repeat(64),
          retrieved_on: '2026-10-02',
          content_reviewed_at: '2026-10-03T00:00:00Z',
        }),
      ),
    ).toBe('content_reviewed');
  });

  it('a checksum without a date, or a date without a checksum, is not "retrieved"', () => {
    expect(sourceEvidenceLevel(source({ checksum_sha256: 'a'.repeat(64) }))).toBe('registered');
    expect(sourceEvidenceLevel(source({ retrieved_on: '2026-10-02' }))).toBe('registered');
  });

  it('a review recorded without verified identity is not reported as reviewed', () => {
    expect(sourceEvidenceLevel(source({ content_reviewed_at: '2026-10-03T00:00:00Z' }))).toBe(
      'registered',
    );
  });

  it('never calls an indexed source verified, and has distinct wording for every level', () => {
    const labels = Object.values(SOURCE_LEVEL_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
    expect(SOURCE_LEVEL_LABEL.indexed).not.toMatch(/verified|reviewed/i);
    expect(SOURCE_LEVEL_LABEL.retrieved).toMatch(/identity not confirmed/);
  });

  it('lists four steps and marks only the ones with evidence', () => {
    const steps = sourceEvidenceSteps(source({ indexed_on: '2026-10-01' }));
    expect(steps.map((s) => [s.key, s.done])).toEqual([
      ['indexed', true],
      ['retrieved', false],
      ['identity', false],
      ['content', false],
    ]);
  });
});

describe('curriculumVerification', () => {
  const prov = (status: 'unverified' | 'source_backed' | 'reviewed' | 'verified', stale = false) =>
    verification({ status, recorded_status: status, stale });

  it('is pending for anything short of verified, including reviewed', () => {
    for (const status of ['unverified', 'source_backed', 'reviewed'] as const) {
      expect(curriculumVerification(prov(status), []).state).toBe('pending');
    }
  });

  it('is verified only when verified and not stale', () => {
    expect(curriculumVerification(prov('verified'), []).state).toBe('verified');
    expect(curriculumVerification(prov('verified', true), []).state).toBe('pending');
  });

  it('is rejected when any reference was checked and does not match, whatever the recorded level', () => {
    expect(
      curriculumVerification(prov('verified'), [
        { check_result: 'matches' },
        { check_result: 'does_not_match' },
      ]).state,
    ).toBe('rejected');
  });

  it('a partial match is not a rejection and not a verification', () => {
    expect(curriculumVerification(prov('reviewed'), [{ check_result: 'partial' }]).state).toBe(
      'pending',
    );
  });
});
