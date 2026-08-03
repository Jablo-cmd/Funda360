import type { AcademicYear } from '@/features/academic/types/academic.types';

export interface AcademicYearsTableProps {
  years: AcademicYear[];
  canManage: boolean;
  onEdit: (year: AcademicYear) => void;
  onActivate: (year: AcademicYear) => void;
  onArchive: (year: AcademicYear) => void;
  activatingId: string | null;
}

export function AcademicYearsTable({ years, canManage, onEdit, onActivate, onArchive, activatingId }: AcademicYearsTableProps) {
  if (years.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No academic years yet.
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
          {years.map((year) => (
            <tr key={year.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">{year.name}</td>
              <td className="px-4 py-3 text-content-secondary">
                {year.startDate} – {year.endDate}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    year.isActive
                      ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                      : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                  }
                >
                  {year.isActive ? 'Active' : 'Archived'}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(year)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      Edit
                    </button>
                    {year.isActive ? (
                      <button
                        type="button"
                        onClick={() => onArchive(year)}
                        className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={activatingId === year.id}
                        onClick={() => onActivate(year)}
                        className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-60 dark:hover:bg-brand-500/10"
                      >
                        {activatingId === year.id ? 'Activating…' : 'Set active'}
                      </button>
                    )}
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
