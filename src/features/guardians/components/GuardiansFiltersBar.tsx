import { SearchIcon } from '@/components/ui/icons';
import type { GuardiansListFilters } from '@/features/guardians/types/guardian.types';
import { RELATIONSHIP_LABELS } from '@/features/guardians/utils/guardianDisplay';

export interface GuardiansFiltersBarProps {
  filters: GuardiansListFilters;
  onChange: (filters: GuardiansListFilters) => void;
}

export function GuardiansFiltersBar({ filters, onChange }: GuardiansFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
        <input
          type="search"
          value={filters.search ?? ''}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search by name, phone, or email…"
          aria-label="Search guardians"
          className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3.5 text-sm text-content-primary placeholder:text-content-tertiary"
        />
      </div>

      <select
        aria-label="Filter by relationship"
        value={filters.relationshipType ?? ''}
        onChange={(event) =>
          onChange({ ...filters, relationshipType: (event.target.value || undefined) as GuardiansListFilters['relationshipType'] })
        }
        className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-48"
      >
        <option value="">All relationships</option>
        {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
