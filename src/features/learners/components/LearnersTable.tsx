import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { Link } from 'react-router-dom';
import type { Learner } from '@/features/learners/types/learner.types';

export interface LearnersTableProps {
  learners: Learner[];
  canViewSensitive: boolean;
}

const STATUS_STYLES: Record<Learner['status'], string> = {
  prospective: 'bg-surface-sunken text-content-tertiary',
  applied: 'bg-surface-sunken text-content-tertiary',
  accepted: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200',
  enrolled: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200',
  active: 'bg-success-500/10 text-success-500',
  suspended: 'bg-danger-50 text-danger-600',
  transferred: 'bg-surface-sunken text-content-tertiary',
  graduated: 'bg-surface-sunken text-content-tertiary',
  withdrawn: 'bg-surface-sunken text-content-tertiary',
};

export function LearnersTable({ learners, canViewSensitive }: LearnersTableProps) {
  if (learners.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No learners match your filters.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Learner #
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Admission #
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              ID number
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {learners.map((learner) => (
            <tr key={learner.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">
                <Link
                  to={`/learners/${learner.id}`}
                  className="focus-ring rounded text-brand-600 hover:underline dark:text-brand-400"
                >
                  {learner.firstName} {learner.lastName}
                </Link>
              </td>
              <td className="px-4 py-3 text-content-secondary">{learner.learnerNumber}</td>
              <td className="px-4 py-3 text-content-secondary">{learner.admissionNumber}</td>
              <td className="px-4 py-3 text-content-secondary">
                {canViewSensitive ? (learner.idNumber ?? '—') : '••••••••••••'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[learner.status]}`}
                >
                  {learner.status.replace(/_/g, ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScrollContainer>
  );
}
