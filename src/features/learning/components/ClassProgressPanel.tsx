import { useMemo, useState } from 'react';
import type { CurriculumObjectiveRow, TeachingResourceRow } from '@/lib/database.types';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { learningService } from '@/features/learning/services/learningService';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { PROGRESS_META, summariseProgress } from '@/features/learning/utils/toolkit';

const TONE: Record<string, string> = {
  neutral: 'bg-surface-sunken text-content-secondary',
  info: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  good: 'bg-success-500/10 text-success-500',
  warn: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  strong: 'bg-brand-600 text-white',
};

export interface ClassProgressPanelProps {
  classId: string;
  objectives: CurriculumObjectiveRow[];
  resources: TeachingResourceRow[];
  /** Bumped by the parent after results are recorded so this panel reloads. */
  refreshKey: number;
}

export function ClassProgressPanel({
  classId,
  objectives,
  resources,
  refreshKey,
}: ClassProgressPanelProps) {
  const { showToast } = useToast();
  const [objectiveId, setObjectiveId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeObjectiveId =
    objectiveId && objectives.some((o) => o.id === objectiveId)
      ? objectiveId
      : (objectives[0]?.id ?? null);
  const resourceTitles = useMemo(() => new Map(resources.map((r) => [r.id, r.title])), [resources]);

  const progress = useLoad(
    () => learningService.getClassProgress(classId, activeObjectiveId as string),
    `progress:${classId}:${activeObjectiveId}:${refreshKey}:${version}`,
    Boolean(activeObjectiveId),
  );
  const rows = progress.data ?? [];
  const summary = summariseProgress(rows);

  const recommendations = useLoad(
    () =>
      learningService.listOpenRecommendations(activeObjectiveId as string, rows, resourceTitles),
    `recs:${classId}:${activeObjectiveId}:${refreshKey}:${version}:${rows.length}`,
    Boolean(activeObjectiveId) && rows.length > 0,
  );

  async function suggest() {
    if (!activeObjectiveId) return;
    setIsGenerating(true);
    setActionError(null);
    try {
      const created = await learningService.generateRecommendations(classId, activeObjectiveId);
      showToast(
        created > 0
          ? `${created} new suggestion${created === 1 ? '' : 's'} based on recorded results.`
          : 'No new suggestions. Nothing has changed since last time.',
        { variant: 'info' },
      );
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Could not work out suggestions.'));
    } finally {
      setIsGenerating(false);
    }
  }

  async function resolve(id: string, status: 'accepted' | 'dismissed') {
    setActionError(null);
    try {
      await learningService.updateRecommendation(id, status);
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Could not update this suggestion.'));
    }
  }

  if (objectives.length === 0) {
    return (
      <p className="text-sm text-content-tertiary">This topic has no learning objectives yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="progress-objective" className="text-sm font-medium text-content-primary">
          Learning objective
        </label>
        <select
          id="progress-objective"
          value={activeObjectiveId ?? ''}
          onChange={(e) => setObjectiveId(e.target.value)}
          className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
        >
          {objectives.map((o) => (
            <option key={o.id} value={o.id}>
              {o.description}
            </option>
          ))}
        </select>
      </div>

      <ErrorAlert message={progress.error ?? actionError} />
      {progress.isLoading && rows.length === 0 ? (
        <LoadingBlock label="Loading class progress…" compact />
      ) : (
        <>
          <ul className="flex flex-wrap gap-2" aria-label="Class summary">
            {(
              ['mastered', 'completed', 'in_progress', 'needs_support', 'not_started'] as const
            ).map((status) => (
              <li
                key={status}
                className={`rounded-full px-3 py-1 text-sm font-medium ${TONE[PROGRESS_META[status].tone]}`}
              >
                <span aria-hidden="true">{PROGRESS_META[status].symbol} </span>
                {summary.counts[status]} {PROGRESS_META[status].label.toLowerCase()}
              </li>
            ))}
          </ul>

          {summary.total === summary.counts.not_started && (
            <p className="rounded-card border border-dashed border-border px-4 py-4 text-sm text-content-secondary">
              No results recorded for this objective yet. Teach the lesson, give the quick check,
              then record the results here.
            </p>
          )}

          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface-raised">
            {rows.map((row) => {
              const meta = PROGRESS_META[row.status];
              return (
                <li
                  key={row.learner_id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-content-primary">
                    {row.first_name} {row.last_name}
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    {row.latest_percent !== null && (
                      <span className="text-content-tertiary">
                        {Math.round(row.latest_percent)}%
                        {row.evidence_count > 1 ? ` · ${row.evidence_count} tries` : ''}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[meta.tone]}`}
                    >
                      <span aria-hidden="true">{meta.symbol} </span>
                      {meta.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-3">
            <div className="sm:w-auto sm:max-w-xs">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void suggest()}
                isLoading={isGenerating}
                disabled={summary.total === summary.counts.not_started}
              >
                Suggest next steps
              </Button>
            </div>
            <p className="text-xs text-content-tertiary">
              Suggestions come only from results you have recorded. Nothing is predicted.
            </p>
            {(recommendations.data ?? []).length > 0 && (
              <ul className="flex flex-col gap-2" aria-label="Suggested next steps">
                {(recommendations.data ?? []).map((rec) => (
                  <li
                    key={rec.id}
                    className="flex flex-col gap-1.5 rounded-card border border-border bg-surface-raised p-3"
                  >
                    <p className="break-words text-sm font-semibold text-content-primary">
                      {rec.learnerName}:{' '}
                      {rec.kind === 'remediation'
                        ? 'needs support'
                        : rec.kind === 'extension'
                          ? 'ready for a challenge'
                          : 'check again'}
                    </p>
                    <p className="break-words text-sm text-content-secondary">{rec.reason}</p>
                    {rec.resourceTitle && (
                      <p className="break-words text-sm text-content-primary">
                        Try: {rec.resourceTitle}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void resolve(rec.id, 'accepted')}
                        className="focus-ring min-h-11 rounded-md border border-border-strong px-4 text-sm font-semibold text-content-primary hover:bg-surface-sunken"
                      >
                        Accept<span className="sr-only"> suggestion for {rec.learnerName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolve(rec.id, 'dismissed')}
                        className="focus-ring min-h-11 rounded-md px-4 text-sm font-medium text-content-secondary hover:bg-surface-sunken"
                      >
                        Dismiss<span className="sr-only"> suggestion for {rec.learnerName}</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
