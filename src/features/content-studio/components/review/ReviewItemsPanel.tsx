import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { curriculumReviewService } from '@/features/content-studio/services/curriculumReviewService';
import {
  FlagDialog,
  ReviewDecisionDialog,
  type DecisionTarget,
} from '@/features/content-studio/components/review/ReviewDecisionDialog';
import { Field, selectClass } from '@/features/content-studio/components/StudioBits';
import {
  itemState,
  itemStateLabel,
  type AssessmentItem,
  type ItemState,
  type LessonItem,
  type ObjectiveItem,
  type QuestionItem,
  type ResourceItem,
  type ReviewItemBase,
} from '@/features/content-studio/utils/review';
import type { CurriculumSourceRow, ReviewEntityType } from '@/lib/database.types';

const STATE_CLASS: Record<ItemState, string> = {
  pending: 'bg-surface-sunken text-content-secondary',
  stale: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  verified: 'bg-success-500/10 text-success-500',
  accepted: 'bg-success-500/10 text-success-500',
  needs_correction: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  rejected: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10',
};

function StateBadge({ item }: { item: ReviewItemBase }) {
  const state = itemState(item.review);
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_CLASS[state]}`}>
      {itemStateLabel(state)}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-content-tertiary">{label}</dt>
      <dd className="break-words text-sm text-content-primary">{children}</dd>
    </div>
  );
}

function Blocks({ body }: { body: ResourceItem['body'] }) {
  const blocks = body?.blocks ?? [];
  if (blocks.length === 0) return <p className="text-xs text-content-tertiary">No content blocks.</p>;
  return (
    <div className="flex flex-col gap-2 text-sm text-content-secondary">
      {blocks.map((b, i) => (
        <div key={i} className="break-words">
          {b.text && <p>{b.text}</p>}
          {b.items && (
            <ol className="list-decimal pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

function reviewLine(item: ReviewItemBase): ReactNode {
  if (!item.review) return null;
  const r = item.review;
  return (
    <p className="break-words text-xs text-content-tertiary">
      Last decision {new Date(r.reviewed_at).toLocaleDateString('en-ZA')}: {r.notes}
      {r.source_section ? ` · Source section ${r.source_section}, page ${r.source_page ?? ''}` : ''}
    </p>
  );
}

interface TypeConfig<T extends ReviewItemBase> {
  heading: string;
  intro: string;
  label: (item: T) => string;
  flaggable: boolean;
  render: (item: T) => ReactNode;
  filterText: (item: T) => string;
}

const OBJECTIVES: TypeConfig<ObjectiveItem> = {
  heading: 'Objectives',
  intro:
    'Verify an objective only after checking it against the source. You will be asked for the source, the section and the page or reference. If you cannot find supporting evidence, request a correction or reject it: there is no “aligned” checkbox.',
  label: (o) => `${o.code}: ${o.description}`,
  flaggable: false,
  filterText: (o) => `${o.code} ${o.description} ${o.topic} ${o.subtopic ?? ''}`,
  render: (o) => (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Fact label="Topic">{o.topic}</Fact>
      <Fact label="Subtopic">{o.subtopic ?? 'None'}</Fact>
      <Fact label="Linked">
        {o.lessons} lessons · {o.resources} resources · {o.assessments} practice checks ({o.questions} questions)
      </Fact>
      <Fact label="Source reference as recorded (not verified)">{o.source_reference ?? 'None'}</Fact>
    </dl>
  ),
};

const LESSONS: TypeConfig<LessonItem> = {
  heading: 'Lessons',
  intro: 'Read each lesson as a teacher would deliver it. Negative decisions need notes and create a finding; the lesson is never edited by the review.',
  label: (l) => l.title,
  flaggable: true,
  filterText: (l) => `${l.title} ${l.objectives.join(' ')}`,
  render: (l) => (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Fact label="Objectives">{l.objectives.join(', ') || 'None'}</Fact>
        <Fact label="Planned time">{l.minutes ? `${l.minutes} minutes` : 'Not set'}</Fact>
      </dl>
      <details className="text-sm">
        <summary className="focus-ring cursor-pointer font-medium text-content-primary">Teaching explanation and notes</summary>
        <div className="mt-2 flex flex-col gap-2 text-content-secondary">
          <p className="break-words">{l.description}</p>
          {l.teacher_notes && <p className="break-words"><strong>Teacher notes:</strong> {l.teacher_notes}</p>}
          {l.learner_instructions && <p className="break-words"><strong>Learner instructions:</strong> {l.learner_instructions}</p>}
        </div>
      </details>
      <details className="text-sm">
        <summary className="focus-ring cursor-pointer font-medium text-content-primary">
          {l.activities.length} activities, {l.resources.length} resources (practice, support, challenge, assessment)
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-content-secondary">
          {l.activities.map((a) => (
            <li key={a.title} className="break-words">
              Activity: {a.title} ({a.type.replace(/_/g, ' ')}, {a.minutes ?? '?'} min). {a.instructions}
            </li>
          ))}
          {l.resources.map((r) => (
            <li key={r.title} className="break-words">
              {r.stage}: {r.title} ({r.kind.replace(/_/g, ' ')})
            </li>
          ))}
        </ul>
      </details>
      <details className="text-sm">
        <summary className="focus-ring cursor-pointer font-medium text-content-primary">Source references ({l.sources.length}, none verified unless stated)</summary>
        <ul className="mt-2 list-disc pl-5 text-content-secondary">
          {l.sources.map((s, i) => (
            <li key={i} className="break-words">
              {s.title} · {s.locator} · source {s.status} · check: {s.check_result ?? 'not checked'}
            </li>
          ))}
        </ul>
      </details>
    </div>
  ),
};

const RESOURCES: TypeConfig<ResourceItem> = {
  heading: 'Resources',
  intro: 'Flag problems you find without editing: factual errors, curriculum mismatch, age suitability, language, unclear instructions, unsuitable activities, incorrect answers, low-resource problems or assessment problems.',
  label: (r) => r.title,
  flaggable: true,
  filterText: (r) => `${r.title} ${r.stage} ${r.kind} ${r.objectives.join(' ')}`,
  render: (r) => (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Fact label="Type and stage">{r.kind.replace(/_/g, ' ')} · {r.stage}</Fact>
        <Fact label="Difficulty">{r.difficulty}</Fact>
        <Fact label="Lessons">{r.lessons.join('; ') || 'None'}</Fact>
        <Fact label="Objectives">{r.objectives.join(', ') || 'None'}</Fact>
        <Fact label="Delivery">
          {r.printable ? 'Printable' : 'Not printable'} · {r.cacheable ? 'Works offline' : 'Needs a connection'} ·{' '}
          {r.projector_required ? 'Needs a projector' : 'No projector'} · device: {r.device} · connectivity: {r.connectivity}
        </Fact>
        <Fact label="Formats">{r.formats.join(', ')}</Fact>
      </dl>
      <details className="text-sm">
        <summary className="focus-ring cursor-pointer font-medium text-content-primary">Content, answers and teacher notes</summary>
        <div className="mt-2">
          <Blocks body={r.body} />
        </div>
      </details>
    </div>
  ),
};

const ASSESSMENTS: TypeConfig<AssessmentItem> = {
  heading: 'Practice checks',
  intro: 'These are Funda360 practice checks, not the DBE formal assessment. Review each check, then review its questions on the Questions tab.',
  label: (a) => a.title,
  flaggable: true,
  filterText: (a) => a.title,
  render: (a) => (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Fact label="Purpose">{a.summary ?? 'Practice'}</Fact>
      <Fact label="Questions">{a.questions}</Fact>
      <Fact label="Planned time">{a.minutes ? `${a.minutes} minutes` : 'Not set'}</Fact>
    </dl>
  ),
};

const QUESTIONS: TypeConfig<QuestionItem> = {
  heading: 'Questions',
  intro: 'Check each question and its key. Needs correction or Reject creates a finding; the question is never changed by the review.',
  label: (q) => `${q.assessment}, question ${q.position}: ${q.prompt}`,
  flaggable: true,
  filterText: (q) => `${q.assessment} ${q.prompt} ${q.objective ?? ''} ${q.difficulty}`,
  render: (q) => (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Fact label="Question">{q.prompt}</Fact>
      <Fact label="Answer (teacher only)">{formatAnswer(q.answer)}</Fact>
      {q.options.length > 0 && <Fact label="Options">{q.options.join(' | ')}</Fact>}
      <Fact label="Marking notes">{q.marking_notes ?? 'None'}</Fact>
      <Fact label="Objective">{q.objective ?? 'None'}</Fact>
      <Fact label="Type and level">
        {q.type.replace(/_/g, ' ')} · {q.difficulty === 'foundational' ? 'support' : q.difficulty === 'advanced' ? 'challenge' : 'core'} · {q.marks} mark(s)
      </Fact>
    </dl>
  ),
};

function formatAnswer(a: unknown): string {
  if (Array.isArray(a)) return a.join(', ');
  if (typeof a === 'boolean') return a ? 'True' : 'False';
  return a === null || a === undefined ? 'None' : String(a);
}

const CONFIG = {
  objective: OBJECTIVES,
  lesson: LESSONS,
  resource: RESOURCES,
  assessment: ASSESSMENTS,
  question: QUESTIONS,
} as const;

type ListedType = keyof typeof CONFIG;
const PAGE_SIZE = 30;

const FILTERS: Array<{ value: 'all' | ItemState; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'needs_correction', label: 'Needs correction' },
  { value: 'rejected', label: 'Rejected' },
];

/** One list of units to review: the unit's facts, its current decision, and the actions. */
export function ReviewItemsPanel({
  versionId,
  type,
  sources,
  locked,
  onChanged,
  refreshKey,
}: {
  versionId: string;
  type: ListedType;
  sources: CurriculumSourceRow[];
  locked: boolean;
  onChanged: () => void;
  refreshKey: number;
}) {
  const cfg = CONFIG[type] as unknown as TypeConfig<ReviewItemBase & Record<string, never>>;
  const [rev, setRev] = useState(0);
  const list = useLoad(
    () => curriculumReviewService.items<ReviewItemBase & Record<string, never>>(versionId, type as ReviewEntityType),
    `${versionId}:${type}:${rev}:${refreshKey}`,
  );
  const [filter, setFilter] = useState<'all' | ItemState>('all');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const [flag, setFlag] = useState<{ entity: ReviewEntityType; id: string; label: string } | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((it) => {
      const state = itemState(it.review);
      const matchesState =
        filter === 'all' || state === filter || (filter === 'pending' && state === 'stale');
      return matchesState && (!q || cfg.filterText(it).toLowerCase().includes(q));
    });
  }, [list.data, filter, search, cfg]);

  const done = () => {
    setRev((n) => n + 1);
    onChanged();
  };

  return (
    <Card title={cfg.heading}>
      <p className="text-sm text-content-secondary">{cfg.intro}</p>
      {locked && (
        <p className="rounded-card border border-border p-3 text-sm text-content-secondary">
          This curriculum version is past review, so decisions can no longer be recorded. You can
          still flag a problem on the Findings tab.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Show">
          <select
            className={selectClass}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as 'all' | ItemState);
              setShown(PAGE_SIZE);
            }}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            className={selectClass}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShown(PAGE_SIZE);
            }}
          />
        </Field>
      </div>
      <ErrorAlert message={list.error} />
      {list.isLoading && !list.data ? (
        <LoadingBlock label={`Loading ${cfg.heading.toLowerCase()}…`} />
      ) : (
        <>
          <p className="text-xs text-content-tertiary" role="status">
            Showing {Math.min(shown, rows.length)} of {rows.length} ({(list.data ?? []).length} in total)
          </p>
          <ul className="flex flex-col gap-3" aria-label={cfg.heading}>
            {rows.slice(0, shown).map((it) => (
              <li key={it.id} className="flex min-w-0 flex-col gap-3 rounded-card border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 break-words text-sm font-semibold text-content-primary">{cfg.label(it)}</h3>
                  <StateBadge item={it} />
                </div>
                {cfg.render(it)}
                {reviewLine(it)}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={locked}
                    onClick={() =>
                      setTarget({ entity: type as ReviewEntityType, id: it.id, label: cfg.label(it), current: it.review })
                    }
                    aria-label={`Review: ${cfg.label(it)}`}
                  >
                    Review
                  </Button>
                  {cfg.flaggable && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setFlag({ entity: type as ReviewEntityType, id: it.id, label: cfg.label(it) })}
                      aria-label={`Flag an issue: ${cfg.label(it)}`}
                    >
                      Flag an issue
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {shown < rows.length && (
            <Button type="button" variant="secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show more
            </Button>
          )}
        </>
      )}
      <ReviewDecisionDialog
        versionId={versionId}
        target={target}
        sources={sources}
        onClose={() => setTarget(null)}
        onDone={done}
      />
      <FlagDialog versionId={versionId} target={flag} onClose={() => setFlag(null)} onDone={done} />
    </Card>
  );
}
