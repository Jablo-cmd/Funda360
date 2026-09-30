import { cn } from '@/lib/cn';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
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

  const renderAction = (school: School, isActive: boolean, fullWidth: boolean) =>
    isActive ? (
      <span className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
        Active
      </span>
    ) : (
      <button
        type="button"
        onClick={() => onSwitch(school)}
        disabled={switchingId === school.id}
        className={cn(
          'focus-ring rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60',
          fullWidth && 'min-h-11 w-full text-sm',
        )}
      >
        {switchingId === school.id ? 'Switching…' : 'Switch to this school'}
      </button>
    );

  return (
    <>
      {/* Phones: one card per school, so the switch action is never hidden behind a sideways swipe. */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {schools.map((school) => {
          const isActive = school.id === activeSchoolId;
          return (
            <li key={school.id} className="rounded-card border border-border bg-surface-raised p-4">
              <p className="break-words font-medium text-content-primary">{school.name}</p>
              <p className="mt-1 text-sm">
                <span className="capitalize text-content-secondary">{school.schoolType}</span>
                <span aria-hidden="true" className="text-content-tertiary">
                  {' '}
                  ·{' '}
                </span>
                <span className={cn('capitalize', STATUS_CLASSES[school.status])}>
                  {school.status}
                </span>
              </p>
              <div className="mt-3">{renderAction(school, isActive, true)}</div>
            </li>
          );
        })}
      </ul>

      <div className="hidden sm:block">
        <TableScrollContainer>
          <table className="w-full min-w-[30rem] text-left text-sm">
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
                    <td className="px-4 py-3 capitalize text-content-secondary">
                      {school.schoolType}
                    </td>
                    <td className={cn('px-4 py-3 capitalize', STATUS_CLASSES[school.status])}>
                      {school.status}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {renderAction(school, isActive, false)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollContainer>
      </div>
    </>
  );
}
