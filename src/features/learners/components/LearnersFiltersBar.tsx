import { SearchIcon } from '@/components/ui/icons';
import { LEARNER_STATUS_OPTIONS } from '@/features/learners/constants/learnerStatusLabels';
import type { LearnersListFilters, LearnerStatus } from '@/features/learners/types/learner.types';

export interface LearnersFiltersBarProps {
  filters: LearnersListFilters;
  onChange: (filters: LearnersListFilters) => void;
}

export function LearnersFiltersBar({ filters, onChange }: LearnersFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
        <input
          type="search"
          value={filters.search ?? ''}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search by name, learner # or admission #…"
          aria-label="Search learners"
          className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3.5 text-sm text-content-primary placeholder:text-content-tertiary"
        />
      </div>

      <select
        aria-label="Filter by status"
        value={filters.status ?? ''}
        onChange={(event) =>
          onChange({ ...filters, status: (event.target.value || undefined) as LearnerStatus | undefined })
        }
        className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-48"
      >
        <option value="">All statuses</option>
        {LEARNER_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
