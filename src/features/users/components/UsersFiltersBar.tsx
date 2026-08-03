import { SearchIcon } from '@/components/ui/icons';
import { ASSIGNABLE_ROLE_LABELS } from '@/features/users/types/user.types';
import type { UsersListFilters } from '@/features/users/types/user.types';
import type { UserRole } from '@/features/auth/types/auth.types';
import type { ProfileStatus } from '@/types/profile.types';

export interface UsersFiltersBarProps {
  filters: UsersListFilters;
  onChange: (filters: UsersListFilters) => void;
}

const STATUS_OPTIONS: { value: ProfileStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

export function UsersFiltersBar({ filters, onChange }: UsersFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
        <input
          type="search"
          value={filters.search ?? ''}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search by name or email…"
          aria-label="Search users"
          className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3.5 text-sm text-content-primary placeholder:text-content-tertiary"
        />
      </div>

      <select
        aria-label="Filter by role"
        value={filters.role ?? ''}
        onChange={(event) =>
          onChange({ ...filters, role: (event.target.value || undefined) as UserRole | undefined })
        }
        className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-48"
      >
        <option value="">All roles</option>
        {Object.entries(ASSIGNABLE_ROLE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by status"
        value={filters.status ?? ''}
        onChange={(event) =>
          onChange({ ...filters, status: (event.target.value || undefined) as ProfileStatus | undefined })
        }
        className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-40"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
