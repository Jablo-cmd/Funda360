import { useMemo } from 'react';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useLearnerResults } from '@/features/assessments/hooks/useLearnerResults';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useSchool } from '@/features/school/hooks/useSchool';
import { toPercentage } from '@/features/assessments/utils/calculations';

export interface ChildAcademicsTabProps {
  learnerId: string;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Deliberately does not group by term/academic year — guardians have no
 * RLS access to those tables in V1 (see the parent_portal_v1 migration
 * header: not needed to resolve "current class", so not granted).
 * Results are simply listed most-recent-first with subject name and mark.
 */
export function ChildAcademicsTab({ learnerId }: ChildAcademicsTabProps) {
  const { results, isLoading: resultsLoading, error } = useLearnerResults(learnerId);
  const { school } = useSchool();
  const { subjects, isLoading: subjectsLoading } = useSubjects(school?.id);

  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate)),
    [results],
  );

  const overallAverage = useMemo(() => {
    if (results.length === 0) return null;
    const percentages = results.map((r) => toPercentage(r.mark, r.maxMark));
    return Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
  }, [results]);

  if (resultsLoading || subjectsLoading) {
    return <LoadingBlock label="Loading academic results…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert message={error} />

      {sortedResults.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No assessment results yet.
        </p>
      ) : (
        <>
          {overallAverage !== null && (
            <div className="rounded-card border border-border bg-surface-raised p-4 text-center sm:w-48">
              <p className="text-2xl font-bold text-content-primary">{overallAverage}%</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-content-tertiary">Overall average</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {sortedResults.map((result) => (
              <div key={result.resultId} className="rounded-card border border-border bg-surface-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-content-primary">
                      {subjectsById[result.subjectId]?.name ?? 'Assessment'}
                    </p>
                    <p className="mt-0.5 text-sm text-content-secondary">{result.title}</p>
                    <p className="mt-0.5 text-xs text-content-tertiary">{formatDate(result.assessmentDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-content-primary">{toPercentage(result.mark, result.maxMark)}%</p>
                    <p className="text-xs text-content-tertiary">
                      {result.mark}/{result.maxMark}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
