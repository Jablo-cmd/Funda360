import { Link } from 'react-router-dom';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import type { GuardianLearnerLink } from '@/features/guardians/types/guardian.types';
import { guardianRelationshipSummary, guardianSecondaryBadges } from '@/features/guardians/utils/guardianDisplay';

export interface GuardianRelationshipsTableProps {
  links: GuardianLearnerLink[];
  canManage: boolean;
  onEdit: (link: GuardianLearnerLink) => void;
  onArchive: (link: GuardianLearnerLink) => void;
  onRestore: (link: GuardianLearnerLink) => void;
}

export function GuardianRelationshipsTable({ links, canManage, onEdit, onArchive, onRestore }: GuardianRelationshipsTableProps) {
  if (links.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        Not linked to any learners yet.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">Learner</th>
            <th scope="col" className="px-4 py-3 font-medium">Relationship</th>
            <th scope="col" className="px-4 py-3 font-medium">Other roles</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            {canManage && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.relationshipId} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">
                <Link to={`/learners/${link.learnerId}`} className="focus-ring rounded text-brand-600 hover:underline dark:text-brand-300">
                  {link.learnerFirstName} {link.learnerLastName}
                </Link>
              </td>
              <td className="px-4 py-3 text-content-secondary">{guardianRelationshipSummary(link)}</td>
              <td className="px-4 py-3 text-content-secondary">{guardianSecondaryBadges(link).join(', ') || '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    link.active
                      ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                      : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                  }
                >
                  {link.active ? 'Active' : 'Removed'}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(link)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => (link.active ? onArchive(link) : onRestore(link))}
                      className={
                        link.active
                          ? 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50'
                          : 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                      }
                    >
                      {link.active ? 'Deactivate' : 'Restore'}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScrollContainer>
  );
}
