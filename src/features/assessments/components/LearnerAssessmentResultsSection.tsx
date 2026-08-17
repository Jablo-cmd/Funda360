import { useLearnerResults } from '@/features/assessments/hooks/useLearnerResults';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/types/assessment.types';
import { toPercentage } from '@/features/assessments/utils/calculations';
import type { AcademicYear, Subject, Term } from '@/features/academic/types/academic.types';

export interface LearnerAssessmentResultsSectionProps {
  learnerId: string;
  subjectsById: Record<string, Subject>;
  termsById: Record<string, Term>;
  academicYearsById: Record<string, AcademicYear>;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The learner's assessment history — not a report card, just the flat record of every mark they've received, per the sprint brief. */
export function LearnerAssessmentResultsSection({
  learnerId,
  subjectsById,
  termsById,
  academicYearsById,
}: LearnerAssessmentResultsSectionProps) {
  const { results, isLoading, error } = useLearnerResults(learnerId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
        />
        <span className="sr-only">Loading academic results…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
      >
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No assessment results are available for this learner.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Subject
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Assessment
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Term
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Mark
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.resultId} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">
                {subjectsById[result.subjectId]?.name ?? '—'}
              </td>
              <td className="px-4 py-3 text-content-secondary">
                {result.title}
                <span className="ml-1.5 text-xs text-content-tertiary">
                  ({ASSESSMENT_TYPE_LABELS[result.assessmentType]})
                </span>
              </td>
              <td className="px-4 py-3 text-content-secondary">
                {termsById[result.termId]?.name ?? '—'}
                {academicYearsById[result.academicYearId] ? ` · ${academicYearsById[result.academicYearId]?.name}` : ''}
              </td>
              <td className="px-4 py-3 font-mono text-content-secondary">{formatDate(result.assessmentDate)}</td>
              <td className="px-4 py-3 text-right font-mono text-content-primary">
                {result.mark}/{result.maxMark}
              </td>
              <td className="px-4 py-3 text-right font-mono text-content-secondary">
                {toPercentage(result.mark, result.maxMark)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
