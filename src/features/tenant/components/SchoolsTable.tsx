import { cn } from '@/lib/cn';
import type { School } from '@/types/school.types';

export interface SchoolsTableProps {
  schools: School[];
  activeSchoolId: string | null;
  onSwitch: (school: School) => void;
  switchingId: string | null;
}

const STATUS_CLASSES: Record<School['status'], string> = {
  active: 'text-success-500',
  pending: 'text-warning-600 dark:text-warning-500',
  inactive: 'text-content-tertiary',
  suspended: 'text-danger-600',
};

export function SchoolsTable({
  schools,
  activeSchoolId,
  onSwitch,
  switchingId,
}: SchoolsTableProps) {
  if (schools.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No schools have been created yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-raised text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              School
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => {
            const isActive = school.id === activeSchoolId;
            return (
              <tr key={school.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-content-primary">{school.name}</td>
                <td className="px-4 py-3 capitalize text-content-secondary">{school.schoolType}</td>
                <td className={cn('px-4 py-3 capitalize', STATUS_CLASSES[school.status])}>
                  {school.status}
                </td>
                <td className="px-4 py-3 text-right">
                  {isActive ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitch(school)}
                      disabled={switchingId === school.id}
                      className="focus-ring rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {switchingId === school.id ? 'Switching…' : 'Switch to this school'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
