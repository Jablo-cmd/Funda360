import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import type { Class, Grade } from '@/features/academic/types/academic.types';

export interface ClassesTableProps {
  classes: Class[];
  grades: Grade[];
  canManage: boolean;
  onEdit: (classItem: Class) => void;
  onToggleActive: (classItem: Class) => void;
}

export function ClassesTable({ classes, grades, canManage, onEdit, onToggleActive }: ClassesTableProps) {
  const gradeNameById = new Map(grades.map((grade) => [grade.id, grade.name]));

  if (classes.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No classes match your filters.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Grade
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Capacity
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
          {classes.map((classItem) => (
            <tr key={classItem.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">{classItem.name}</td>
              <td className="px-4 py-3 text-content-secondary">{gradeNameById.get(classItem.gradeId) ?? '—'}</td>
              <td className="px-4 py-3 text-content-secondary">{classItem.capacity}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    classItem.active
                      ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                      : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                  }
                >
                  {classItem.active ? 'Active' : 'Archived'}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(classItem)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(classItem)}
                      className={
                        classItem.active
                          ? 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50'
                          : 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                      }
                    >
                      {classItem.active ? 'Archive' : 'Restore'}
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
