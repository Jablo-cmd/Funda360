import type {
  CurriculumSourceRow,
  FindingCategory,
  ReviewDecisionValue,
  ReviewEntityType,
} from '@/lib/database.types';

/** What the review screens know about the curriculum review workflow. Pure helpers: no network. */

export interface ReviewCurrent {
  decision: ReviewDecisionValue;
  stale: boolean;
  reviewer: string;
  reviewed_at: string;
  notes: string;
  source_id: string | null;
  source_section: string | null;
  source_page: string | null;
}

export interface CountBlock {
  total: number;
  positive: number;
  needs_correction: number;
  rejected: number;
  pending: number;
}

export interface ReviewSummary {
  version_id: string;
  version_code: string;
  version_name: string;
  version_status: 'draft' | 'review' | 'approved' | 'published' | 'retired';
  review_workflow: boolean;
  ready: boolean;
  overall: string;
  blockers: string[];
  objective: CountBlock;
  lesson: CountBlock;
  resource: CountBlock;
  assessment: CountBlock;
  question: CountBlock;
  open_questions: { total: number; open: number; resolved: number; deferred: number; deferred_material: number };
  formal_assessment: { total: number; details_recorded: number; verified: number };
  open_findings: number;
  sources: Array<{
    id: string;
    title: string;
    doc_type: string;
    evidence_level: string;
    licence_status: string;
    retrieval_status: string;
  }>;
}

export type ReviewItemBase = { id: string; review: ReviewCurrent | null };
export type ObjectiveItem = ReviewItemBase & {
  code: string;
  description: string;
  topic: string;
  subtopic: string | null;
  source_reference: string | null;
  lessons: number;
  resources: number;
  assessments: number;
  questions: number;
};
export type LessonItem = ReviewItemBase & {
  title: string;
  description: string | null;
  teacher_notes: string | null;
  learner_instructions: string | null;
  origin: string;
  status: string;
  minutes: number | null;
  objectives: string[];
  activities: Array<{ title: string; type: string; instructions: string; minutes: number | null }>;
  resources: Array<{ title: string; stage: string; kind: string }>;
  sources: Array<{ title: string; locator: string; status: string; check_result: string | null }>;
};
export type ResourceItem = ReviewItemBase & {
  title: string;
  summary: string | null;
  kind: string;
  stage: string;
  difficulty: string;
  formats: string[];
  printable: boolean;
  cacheable: boolean;
  projector_required: boolean;
  device: string;
  connectivity: string;
  body: { blocks?: Array<{ type: string; text?: string; items?: string[] }> } | null;
  lessons: string[];
  objectives: string[];
};
export type AssessmentItem = ReviewItemBase & { title: string; summary: string | null; minutes: number | null; questions: number };
export type QuestionItem = ReviewItemBase & {
  assessment: string;
  position: number;
  type: string;
  prompt: string;
  options: string[];
  marks: number;
  difficulty: string;
  objective: string | null;
  answer: unknown;
  feedback: string | null;
  marking_notes: string | null;
};

/** The five separate things "verified" can mean. Shown wherever a status could be misread. */
export const LADDER_STEPS: Array<{ key: string; label: string; meaning: string }> = [
  { key: 'indexed', label: 'Indexed', meaning: 'A DBE source was identified at the recorded location.' },
  { key: 'retrieved', label: 'Retrieved', meaning: 'The actual document bytes were downloaded and hashed.' },
  { key: 'identity', label: 'Identity verified', meaning: 'A human confirmed that the retrieved document is the intended authoritative edition.' },
  { key: 'content', label: 'Content reviewed', meaning: 'A human reviewed the actual document.' },
  { key: 'curriculum', label: 'Curriculum verified', meaning: 'A specific Funda360 curriculum unit was checked against the source.' },
];

export const DECISION_LABEL: Record<ReviewDecisionValue, string> = {
  verified: 'Verified',
  accepted: 'Accepted',
  needs_correction: 'Needs correction',
  rejected: 'Rejected',
};

/** The positive word for each kind of unit: objectives are verified against a source, content is accepted. */
export const POSITIVE_DECISION: Record<ReviewEntityType, 'verified' | 'accepted'> = {
  objective: 'verified',
  formal_assessment: 'verified',
  lesson: 'accepted',
  resource: 'accepted',
  assessment: 'accepted',
  question: 'accepted',
};

export const ENTITY_LABEL: Record<ReviewEntityType, string> = {
  objective: 'objective',
  lesson: 'lesson',
  resource: 'resource',
  assessment: 'practice check',
  question: 'question',
  formal_assessment: 'formal assessment',
};

export const FINDING_LABEL: Record<FindingCategory, string> = {
  factual_error: 'Factual error',
  curriculum_mismatch: 'Curriculum mismatch',
  age_suitability: 'Age suitability',
  language_issue: 'Language issue',
  unclear_instruction: 'Unclear instruction',
  unsuitable_activity: 'Unsuitable activity',
  incorrect_answer: 'Incorrect answer',
  low_resource_problem: 'Low-resource problem',
  assessment_problem: 'Assessment problem',
  scope_question: 'Scope question',
  other: 'Other',
};

export const LICENCE_LABEL: Record<CurriculumSourceRow['licence_status'], string> = {
  unreviewed: 'Licence not reviewed',
  permitted: 'Licence: permitted',
  restricted: 'Licence: restricted use',
  not_permitted: 'Licence: not permitted',
};

export type ItemState = 'pending' | 'stale' | ReviewDecisionValue;

/** Where one unit stands. A decision made on content that has since changed counts as stale, which is pending again. */
export function itemState(review: ReviewCurrent | null): ItemState {
  if (!review) return 'pending';
  if (review.stale) return 'stale';
  return review.decision;
}

export function itemStateLabel(state: ItemState): string {
  if (state === 'pending') return 'Pending';
  if (state === 'stale') return 'Changed since review: pending';
  return DECISION_LABEL[state];
}

export interface DecisionInput {
  entity: ReviewEntityType;
  decision: ReviewDecisionValue;
  notes: string;
  sourceId: string;
  section: string;
  page: string;
}

/** Mirrors the server's rules so the form can say what is missing. The database is the authority. */
export function decisionProblems(input: DecisionInput): string[] {
  const out: string[] = [];
  if (input.notes.trim().length < 3) out.push('Write your reviewer notes.');
  const positive = input.decision === 'verified' || input.decision === 'accepted';
  if (positive && (input.entity === 'objective' || input.entity === 'formal_assessment')) {
    if (!input.sourceId) out.push('Choose the source you checked it against.');
    if (input.section.trim().length < 2) out.push('Give the section of the source.');
    if (input.page.trim().length < 1) out.push('Give the page or reference in the source.');
  }
  return out;
}

export interface QuestionAnswerInput {
  status: 'open' | 'resolved' | 'deferred';
  answer: string;
  sourceId: string;
  section: string;
  page: string;
  notes: string;
}

export function questionProblems(input: QuestionAnswerInput): string[] {
  const out: string[] = [];
  if (input.notes.trim().length < 3)
    out.push(input.status === 'deferred' ? 'Say why it is deferred.' : 'Write an explanation.');
  if (input.status === 'resolved') {
    if (input.answer.trim().length < 3) out.push('State the answer.');
    if (!input.sourceId) out.push('Choose the source of the answer.');
    if (input.section.trim().length < 2) out.push('Give the section of the source.');
    if (input.page.trim().length < 1) out.push('Give the page or reference in the source.');
  }
  return out;
}

/** The sources a person may cite as evidence: identity must be verified first. */
export function citableSources(sources: CurriculumSourceRow[]): CurriculumSourceRow[] {
  return sources.filter((s) => s.status === 'verified');
}

export function countLine(block: CountBlock, positiveWord: string): string {
  const parts = [`${block.total} total`, `${block.positive} ${positiveWord}`, `${block.pending} pending`];
  if (block.needs_correction) parts.push(`${block.needs_correction} need correction`);
  if (block.rejected) parts.push(`${block.rejected} rejected`);
  return parts.join(' · ');
}

const URL_OK = /^https:\/\//;
export function parseAlternateUrls(text: string): { urls: string[]; bad: string[] } {
  const urls = text
    .split(/\s+/)
    .map((u) => u.trim())
    .filter(Boolean);
  return { urls, bad: urls.filter((u) => !URL_OK.test(u)) };
}

/** A RECORD line as printed by docs/sources/verify-dbe-sources.sh: tab separated, 10 fields, first is RECORD. */
export function looksLikeRecordLine(text: string): boolean {
  const fields = text.trim().split('\t');
  return fields.length >= 10 && fields[0] === 'RECORD';
}
