import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import type { Term } from '@/features/academic/types/academic.types';

export interface TermsTableProps {
  terms: Term[];
  canManage: boolean;
  onEdit: (term: Term) => void;
  onToggleActive: (term: Term) => void;
}

export function TermsTable({ terms, canManage, onEdit, onToggleActive }: TermsTableProps) {
  if (terms.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No terms for this academic year yet.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              #
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Dates
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            {canManage && (
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {terms.map((term) => (
            <tr key={term.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-content-tertiary">{term.sequence}</td>
              <td className="px-4 py-3 font-medium text-content-primary">{term.name}</td>
              <td className="px-4 py-3 text-content-secondary">
                {term.startDate} – {term.endDate}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    term.active
                      ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                      : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                  }
                >
                  {term.active ? 'Active' : 'Archived'}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(term)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(term)}
                      className={
                        term.active
                          ? 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50'
                          : 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                      }
                    >
                      {term.active ? 'Archive' : 'Restore'}
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
