import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { toPercentage } from '@/features/assessments/utils/calculations';
import type { LearnerAssessmentResult } from '@/features/assessments/types/assessment.types';
import type { Subject } from '@/features/academic/types/academic.types';

export interface AcademicSnapshotCardProps {
  results: LearnerAssessmentResult[];
  subjectsById: Record<string, Subject>;
  isLoading: boolean;
  error: string | null;
  onViewAll: () => void;
}

interface SubjectSnapshot {
  subjectId: string;
  subjectName: string;
  latestPercentage: number;
  averagePercentage: number;
}

/** One row per subject: the most recent mark (what the header-level "Mathematics — 78%" snapshot shows) plus that subject's overall average across every result on file. */
function buildSubjectSnapshots(results: LearnerAssessmentResult[], subjectsById: Record<string, Subject>): SubjectSnapshot[] {
  const bySubject = new Map<string, LearnerAssessmentResult[]>();
  for (const result of results) {
    const list = bySubject.get(result.subjectId) ?? [];
    list.push(result);
    bySubject.set(result.subjectId, list);
  }

  return [...bySubject.entries()]
    .map(([subjectId, subjectResults]): SubjectSnapshot | null => {
      // results are already sorted most-recent-first by the service; a
      // subjectResults list only exists here because at least one result
      // was pushed onto it, so this is always defined in practice.
      const [latest] = subjectResults;
      if (!latest) return null;
      const percentages = subjectResults.map((r) => toPercentage(r.mark, r.maxMark));
      const averagePercentage = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
      return {
        subjectId,
        subjectName: subjectsById[subjectId]?.name ?? 'Unknown subject',
        latestPercentage: toPercentage(latest.mark, latest.maxMark),
        averagePercentage,
      };
    })
    .filter((snapshot): snapshot is SubjectSnapshot => snapshot !== null)
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

function percentageColor(percentage: number): string {
  if (percentage >= 70) return 'text-success-500';
  if (percentage >= 50) return 'text-warning-600 dark:text-warning-500';
  return 'text-danger-600';
}

export function AcademicSnapshotCard({ results, subjectsById, isLoading, error, onViewAll }: AcademicSnapshotCardProps) {
  const snapshots = useMemo(() => buildSubjectSnapshots(results, subjectsById), [results, subjectsById]);
  const overallAverage = useMemo(() => {
    if (snapshots.length === 0) return null;
    return Math.round(snapshots.reduce((sum, s) => sum + s.averagePercentage, 0) / snapshots.length);
  }, [snapshots]);

  return (
    <Card
      title="Academic Snapshot"
      action={
        <button type="button" onClick={onViewAll} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          View full history
        </button>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Loading academic snapshot…" compact />
      ) : error ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-content-tertiary">No assessment results are available for this learner.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {overallAverage !== null && (
            <p className="text-sm text-content-secondary">
              Overall average: <span className={`font-mono font-semibold ${percentageColor(overallAverage)}`}>{overallAverage}%</span>
            </p>
          )}
          <div className="flex flex-col divide-y divide-border">
            {snapshots.map((snapshot) => (
              <div key={snapshot.subjectId} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-content-primary">{snapshot.subjectName}</span>
                <span className={`font-mono text-sm font-semibold ${percentageColor(snapshot.latestPercentage)}`}>
                  {snapshot.latestPercentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
