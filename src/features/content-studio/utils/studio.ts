import type {
  ContentEntityTable,
  ContentProvenance,
  ContentSourceReferenceRow,
  ContentStatus,
  ContentVerificationStatus,
  CurriculumSourceRow,
  ValidationSeverity,
} from '@/lib/database.types';

export const UNIT_LABEL: Record<ContentEntityTable, string> = {
  lessons: 'Lesson',
  teaching_resources: 'Resource',
  learning_assessments: 'Assessment',
};

/** Entity names content_transition() understands. */
export const TRANSITION_ENTITY: Record<ContentEntityTable, string> = {
  lessons: 'lesson',
  teaching_resources: 'teaching_resource',
  learning_assessments: 'learning_assessment',
};

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  published: 'Published',
  retired: 'Retired',
};

/** Said plainly. Nothing here ever claims alignment with an official curriculum unless it was verified. */
export const VERIFICATION_LABEL: Record<ContentVerificationStatus, string> = {
  unverified: 'Not checked against curriculum documents',
  source_backed: 'Has a source reference, not yet checked',
  reviewed: 'Reviewed against its sources by a person',
  verified: 'Verified against a verified source',
};

export const VERIFICATION_OPTIONS: Array<{ value: ContentVerificationStatus; label: string }> = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'source_backed', label: 'Source-backed' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'verified', label: 'Verified' },
];

/** Verification as it applies to the content as it reads now: an edit after review makes it stale. */
export function effectiveVerification(p: Pick<ContentProvenance, 'verification'>): {
  status: ContentVerificationStatus;
  label: string;
  stale: boolean;
} {
  const stale = p.verification.stale;
  const status = stale ? 'unverified' : p.verification.status;
  return {
    status,
    stale,
    label: stale
      ? 'Changed since it was reviewed, so it needs review again'
      : VERIFICATION_LABEL[status],
  };
}

export interface WorkflowAction {
  to: ContentStatus;
  label: string;
  /** Presented as the main action of the step. */
  primary: boolean;
}

/** The moves the lifecycle allows from a status. The database enforces them; this only decides which buttons to show. */
export function workflowActions(status: ContentStatus): WorkflowAction[] {
  switch (status) {
    case 'draft':
      return [{ to: 'review', label: 'Submit for review', primary: true }];
    case 'review':
      return [
        { to: 'approved', label: 'Approve', primary: true },
        { to: 'draft', label: 'Send back to draft', primary: false },
      ];
    case 'approved':
      return [{ to: 'published', label: 'Publish to teachers', primary: true }];
    case 'published':
      return [{ to: 'retired', label: 'Retire', primary: false }];
    default:
      return [];
  }
}

export interface SeverityMeta {
  label: string;
  /** Shown beside the label so severity is never conveyed by colour alone. */
  symbol: string;
  classes: string;
}

export const SEVERITY_META: Record<ValidationSeverity, SeverityMeta> = {
  error: { label: 'Error', symbol: '✕', classes: 'bg-danger-50 text-danger-600' },
  warning: {
    label: 'Warning',
    symbol: '!',
    classes: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  },
  info: { label: 'Note', symbol: 'i', classes: 'bg-surface-sunken text-content-secondary' },
};

export function describeValidation(v: ContentProvenance['validation']): string {
  if (!v) return 'Checks have not been run yet.';
  if (v.stale) return 'The content changed after the last check. Run the checks again.';
  if (!v.passed)
    return `${v.errors} ${v.errors === 1 ? 'error' : 'errors'} to fix before this can be approved.`;
  if (v.unacknowledged_warnings > 0)
    return `Passed. ${v.unacknowledged_warnings} ${v.unacknowledged_warnings === 1 ? 'warning needs' : 'warnings need'} a reviewer's acknowledgement.`;
  return 'Passed with nothing left to acknowledge.';
}

export const DRAFT_ERRORS: Record<string, string> = {
  not_configured: 'AI drafting is not set up on this server yet.',
  forbidden: 'Only platform administrators can create AI drafts.',
  rate_limited: 'You have reached the hourly limit for AI drafts. Please try again later.',
  invalid_request:
    'Those choices cannot be drafted. Make sure the topic and every objective are approved and belong together.',
  not_found: 'That topic could not be found.',
  unauthorized: 'Your session has expired. Please sign in again.',
  request_failed: 'The AI draft could not be created. Nothing was saved. Please try again.',
};

export const PROVIDER_REASONS: Record<string, string> = {
  provider_unavailable: 'The AI service could not be reached.',
  provider_rejected: 'The AI service refused the request.',
  provider_timeout: 'The AI service took too long to answer.',
  provider_empty: 'The AI service returned nothing.',
  context_unavailable: 'The topic details could not be loaded.',
  ingest_unavailable: 'The draft could not be saved.',
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- Source evidence: four different facts about a source document -------------------------------------------------

export type SourceEvidenceLevel =
  'registered' | 'indexed' | 'retrieved' | 'identity_verified' | 'content_reviewed';

export interface EvidenceStep {
  key: 'indexed' | 'retrieved' | 'identity' | 'content';
  label: string;
  meaning: string;
  done: boolean;
  detail: string | null;
}

export const SOURCE_LEVEL_LABEL: Record<SourceEvidenceLevel, string> = {
  registered: 'Registered only: no evidence yet',
  indexed: 'Indexed: found at a location, not downloaded',
  retrieved: 'Retrieved: the file was downloaded, identity not confirmed',
  identity_verified: 'Identity verified: nobody has recorded reading it yet',
  content_reviewed: 'Content reviewed by a person',
};

/** Mirrors source_evidence_level() in the database. Each step needs its own evidence; none implies the next. */
export function sourceEvidenceLevel(
  s: Pick<
    CurriculumSourceRow,
    'status' | 'indexed_on' | 'checksum_sha256' | 'retrieved_on' | 'content_reviewed_at'
  >,
): SourceEvidenceLevel {
  if (s.status === 'verified' && s.content_reviewed_at) return 'content_reviewed';
  if (s.status === 'verified') return 'identity_verified';
  if (s.checksum_sha256 && s.retrieved_on) return 'retrieved';
  if (s.indexed_on) return 'indexed';
  return 'registered';
}

export function sourceEvidenceSteps(s: CurriculumSourceRow): EvidenceStep[] {
  const retrieved = Boolean(s.checksum_sha256 && s.retrieved_on);
  return [
    {
      key: 'indexed',
      label: 'Indexed',
      meaning: 'A document with this title was found at this address.',
      done: Boolean(s.indexed_on),
      detail: s.indexed_on,
    },
    {
      key: 'retrieved',
      label: 'Retrieved',
      meaning: 'The actual file was downloaded and its SHA-256 recorded.',
      done: retrieved,
      detail: retrieved ? `${s.retrieved_on}, SHA-256 ${s.checksum_sha256?.slice(0, 12)}…` : null,
    },
    {
      key: 'identity',
      label: 'Identity verified',
      meaning: 'A person confirmed the downloaded file is the authoritative edition.',
      done: s.status === 'verified',
      detail: s.verified_at ? s.verified_at.slice(0, 10) : null,
    },
    {
      key: 'content',
      label: 'Content reviewed',
      meaning: 'A person read the actual document.',
      done: Boolean(s.content_reviewed_at),
      detail: s.content_review_note,
    },
  ];
}

// --- Curriculum verification: a property of the Funda360 unit, not of the source or its lifecycle step -------------

export type CurriculumVerificationState = 'pending' | 'verified' | 'rejected';

/**
 * Pending: nobody has verified the unit against a verified source (including "reviewed but not verified").
 * Verified: its verification is "verified" for the content as it reads now.
 * Rejected: a reviewer checked a source reference and found that it does not match.
 */
export function curriculumVerification(
  provenance: Pick<ContentProvenance, 'verification'>,
  references: Array<Pick<ContentSourceReferenceRow, 'check_result'>>,
): { state: CurriculumVerificationState; label: string; detail: string } {
  if (references.some((r) => r.check_result === 'does_not_match')) {
    return {
      state: 'rejected',
      label: 'Rejected',
      detail: 'A reviewer found that a source reference does not match this content.',
    };
  }
  const v = effectiveVerification(provenance);
  if (v.status === 'verified') {
    return {
      state: 'verified',
      label: 'Verified',
      detail: 'Verified against a verified source, as the content currently reads.',
    };
  }
  return {
    state: 'pending',
    label: 'Pending',
    detail: v.stale
      ? v.label
      : v.status === 'unverified'
        ? 'Nobody has verified this against a source yet.'
        : v.label,
  };
}
