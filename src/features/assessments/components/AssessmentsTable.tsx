import { Link } from 'react-router-dom';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/types/assessment.types';
import type { Assessment } from '@/features/assessments/types/assessment.types';
import type { Class, Subject, Term } from '@/features/academic/types/academic.types';

export interface AssessmentsTableProps {
  assessments: Assessment[];
  classesById: Record<string, Class>;
  subjectsById: Record<string, Subject>;
  termsById: Record<string, Term>;
  /** Only shown when the caller isn't scoped to a single class already (the admin/top-level view). */
  showClassColumn: boolean;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AssessmentsTable({ assessments, classesById, subjectsById, termsById, showClassColumn }: AssessmentsTableProps) {
  if (assessments.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No assessments have been created for this class yet.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Assessment
            </th>
            {showClassColumn && (
              <th scope="col" className="px-4 py-3 font-medium">
                Class
              </th>
            )}
            <th scope="col" className="px-4 py-3 font-medium">
              Subject
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Term
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Max
            </th>
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">Status</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((assessment) => (
            <tr key={assessment.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">
                <Link
                  to={`/academic/assessments/${assessment.id}`}
                  className="focus-ring rounded text-brand-600 hover:underline dark:text-brand-400"
                >
                  {assessment.title}
                </Link>
              </td>
              {showClassColumn && (
                <td className="px-4 py-3 text-content-secondary">{classesById[assessment.classId]?.name ?? '—'}</td>
              )}
              <td className="px-4 py-3 text-content-secondary">{subjectsById[assessment.subjectId]?.name ?? '—'}</td>
              <td className="px-4 py-3 text-content-secondary">{ASSESSMENT_TYPE_LABELS[assessment.assessmentType]}</td>
              <td className="px-4 py-3 text-content-secondary">{termsById[assessment.termId]?.name ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-content-secondary">{formatDate(assessment.assessmentDate)}</td>
              <td className="px-4 py-3 text-right font-mono text-content-secondary">/{assessment.maxMark}</td>
              <td className="px-4 py-3 text-right">
                {!assessment.active && (
                  <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary">
                    Archived
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScrollContainer>
  );
}
