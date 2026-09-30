import type {
  ContentDifficulty,
  DeviceNeed,
  Json,
  LearnerProgressStatus,
  TeachingResourceRow,
  ToolkitStage,
} from '@/lib/database.types';

export interface StageInfo {
  key: ToolkitStage;
  label: string;
  hint: string;
}

/** The Teacher Toolkit steps, in teaching order. */
export const TOOLKIT_STAGES: StageInfo[] = [
  { key: 'explain', label: 'Explain', hint: 'What to say' },
  { key: 'show', label: 'Show', hint: 'What to draw or display' },
  { key: 'try', label: 'Try', hint: 'Activities for the class' },
  { key: 'practise', label: 'Practise', hint: 'Exercises for learners' },
  { key: 'check', label: 'Check', hint: 'Who understands?' },
  { key: 'support', label: 'Support', hint: 'Help for learners who need it' },
  { key: 'challenge', label: 'Challenge', hint: 'For learners who are ready for more' },
  { key: 'print', label: 'Print', hint: 'Worksheets and teacher resources' },
];

export const DIFFICULTY_LABEL: Record<ContentDifficulty, string> = {
  foundational: 'Foundation',
  standard: 'Standard',
  advanced: 'Advanced',
};

const DIFFICULTY_ORDER: Record<ContentDifficulty, number> = {
  foundational: 0,
  standard: 1,
  advanced: 2,
};

const DEVICE_LABEL: Record<DeviceNeed, string> = {
  none: 'No device needed',
  teacher_device: 'Teacher device',
  shared_device: 'Shared device',
  learner_device: 'Learner devices',
};

export type BadgeTone = 'good' | 'warn' | 'neutral';
export interface AccessBadge {
  label: string;
  tone: BadgeTone;
}

type AccessFields = Pick<
  TeachingResourceRow,
  'connectivity' | 'device' | 'projector_required' | 'printable' | 'size_kb'
>;

/**
 * True when a teacher can run the resource with no projector, no connectivity and
 * no learner device. Mirrors the database rule a lesson must satisfy before it can be published.
 */
export function isLowResource(resource: AccessFields): boolean {
  return (
    !resource.projector_required &&
    resource.connectivity === 'none' &&
    (resource.device === 'none' || resource.device === 'teacher_device')
  );
}

/** Plain-language badges so a teacher sees at a glance whether a resource fits their classroom. */
export function accessBadges(resource: AccessFields): AccessBadge[] {
  const badges: AccessBadge[] = [];
  badges.push(
    resource.connectivity === 'none'
      ? { label: 'Works offline', tone: 'good' }
      : resource.connectivity === 'low'
        ? { label: 'Needs a little data', tone: 'warn' }
        : { label: 'Needs internet', tone: 'warn' },
  );
  badges.push(
    resource.projector_required
      ? { label: 'Needs a projector', tone: 'warn' }
      : { label: 'No projector needed', tone: 'good' },
  );
  badges.push({
    label: DEVICE_LABEL[resource.device],
    tone: resource.device === 'learner_device' ? 'warn' : 'neutral',
  });
  if (resource.printable) badges.push({ label: 'Printable', tone: 'neutral' });
  return badges;
}

/** Resources grouped by toolkit stage, easiest first within a stage. */
export function groupByStage<T extends Pick<TeachingResourceRow, 'stage' | 'difficulty' | 'title'>>(
  resources: T[],
): Record<ToolkitStage, T[]> {
  const grouped = Object.fromEntries(TOOLKIT_STAGES.map((s) => [s.key, [] as T[]])) as Record<
    ToolkitStage,
    T[]
  >;
  for (const resource of resources) grouped[resource.stage].push(resource);
  for (const stage of TOOLKIT_STAGES) {
    grouped[stage.key].sort(
      (a, b) =>
        DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
        a.title.localeCompare(b.title),
    );
  }
  return grouped;
}

export interface ProgressMeta {
  label: string;
  /** Shown next to the label so status is never conveyed by colour alone. */
  symbol: string;
  tone: 'neutral' | 'info' | 'good' | 'warn' | 'strong';
}

export const PROGRESS_META: Record<LearnerProgressStatus, ProgressMeta> = {
  not_started: { label: 'Not started', symbol: '○', tone: 'neutral' },
  in_progress: { label: 'In progress', symbol: '◔', tone: 'info' },
  completed: { label: 'Completed', symbol: '✓', tone: 'good' },
  needs_support: { label: 'Needs support', symbol: '!', tone: 'warn' },
  mastered: { label: 'Mastered', symbol: '★', tone: 'strong' },
};

export interface ProgressSummary {
  counts: Record<LearnerProgressStatus, number>;
  total: number;
  needingSupport: number;
  ready: number;
}

export function summariseProgress(rows: Array<{ status: LearnerProgressStatus }>): ProgressSummary {
  const counts: Record<LearnerProgressStatus, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    needs_support: 0,
    mastered: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return {
    counts,
    total: rows.length,
    needingSupport: counts.needs_support,
    ready: counts.mastered,
  };
}

// --- Resource bodies -----------------------------------------------------------------------

export type ResourceBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'tip'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Turns a resource's stored JSON body into renderable blocks. Anything unexpected is dropped rather
 * than rendered, so content can never inject markup and a malformed body degrades to "no text".
 */
export function parseBlocks(body: Json | undefined): ResourceBlock[] {
  if (!isRecord(body) || !Array.isArray(body.blocks)) return [];
  const blocks: ResourceBlock[] = [];
  for (const raw of body.blocks) {
    if (!isRecord(raw) || typeof raw.type !== 'string') continue;
    switch (raw.type) {
      case 'heading':
      case 'paragraph':
      case 'tip':
        if (typeof raw.text === 'string' && raw.text.trim())
          blocks.push({ type: raw.type, text: raw.text });
        break;
      case 'steps':
      case 'numbered': {
        const items = stringList(raw.items);
        if (items.length > 0) blocks.push({ type: raw.type, items });
        break;
      }
      case 'table': {
        const headers = stringList(raw.headers);
        const rows = Array.isArray(raw.rows)
          ? raw.rows.map(stringList).filter((r) => r.length > 0)
          : [];
        if (headers.length > 0) blocks.push({ type: 'table', headers, rows });
        break;
      }
      default:
        break;
    }
  }
  return blocks;
}

/** Text alternative for a visual resource, when the content provides one. */
export function altTextOf(body: Json | undefined): string | null {
  return isRecord(body) && typeof body.alt_text === 'string' && body.alt_text.trim()
    ? body.alt_text
    : null;
}

export function formatMinutes(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  return minutes === 1 ? '1 min' : `${minutes} min`;
}

/** Parses a typed score. Returns null for blank input and NaN for something unusable. */
export function parseScore(raw: string, maxScore: number): number | null {
  const text = raw.trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > maxScore) return Number.NaN;
  return value;
}
