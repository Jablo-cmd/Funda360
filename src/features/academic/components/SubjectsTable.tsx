import type { Subject } from '@/features/academic/types/academic.types';

export interface SubjectsTableProps {
  subjects: Subject[];
  canManage: boolean;
  onEdit: (subject: Subject) => void;
  onToggleActive: (subject: Subject) => void;
}

export function SubjectsTable({ subjects, canManage, onEdit, onToggleActive }: SubjectsTableProps) {
  if (subjects.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No subjects match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Code
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
          {subjects.map((subject) => (
            <tr key={subject.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium text-content-primary">{subject.name}</p>
                {subject.description && <p className="text-content-tertiary">{subject.description}</p>}
              </td>
              <td className="px-4 py-3 text-content-secondary">{subject.code ?? '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    subject.active
                      ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                      : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                  }
                >
                  {subject.active ? 'Active' : 'Archived'}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(subject)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(subject)}
                      className={
                        subject.active
                          ? 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50'
                          : 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                      }
                    >
                      {subject.active ? 'Archive' : 'Restore'}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
