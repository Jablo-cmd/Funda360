import { useId, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import type { GovernmentReportFilters, ReportingScope } from '@/features/government/types/government.types';
import { areasForLevel, descendantAreaIds, withAreaChange } from '@/features/government/utils/reportFilters';

const FIELD_CLASS =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary lg:h-10';
const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-content-tertiary';

export interface ReportFiltersBarProps {
  scope: ReportingScope;
  filters: GovernmentReportFilters;
  onChange: (filters: GovernmentReportFilters) => void;
  /** Hide the school picker on pages that are already about one school. */
  hideSchool?: boolean;
}

/**
 * Province -> District -> Circuit -> School, then grade, academic year,
 * term and dates. Options come from get_reporting_scope(), so a user is only
 * ever offered areas and schools they may report on.
 */
export function ReportFiltersBar({ scope, filters, onChange, hideSchool = false }: ReportFiltersBarProps) {
  const id = useId();
  const provinces = areasForLevel(scope.areas, 'province', undefined);
  const districts = areasForLevel(scope.areas, 'district', filters.province_id);
  const circuits = areasForLevel(scope.areas, 'circuit', filters.district_id);

  const schools = useMemo(() => {
    const area = filters.circuit_id ?? filters.district_id ?? filters.province_id;
    if (!area) return scope.schools;
    const ids = descendantAreaIds(scope.areas, area);
    return scope.schools.filter((school) => school.education_area_id && ids.has(school.education_area_id));
  }, [scope, filters.circuit_id, filters.district_id, filters.province_id]);

  const set = (patch: GovernmentReportFilters) => onChange({ ...filters, ...patch });
  const hasFilters = Object.values(filters).some((value) => value !== undefined && value !== '');
  const showAreas = scope.areas.length > 0 && scope.caller_kind !== 'school';

  return (
    <div className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-raised p-3 sm:p-4 lg:grid-cols-4">
      {showAreas && (
        <>
          <div>
            <label htmlFor={`${id}-province`} className={LABEL_CLASS}>
              Province
            </label>
            <select
              id={`${id}-province`}
              className={FIELD_CLASS}
              value={filters.province_id ?? ''}
              onChange={(e) => onChange(withAreaChange(filters, 'province_id', e.target.value))}
            >
              <option value="">All provinces</option>
              {provinces.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-district`} className={LABEL_CLASS}>
              District
            </label>
            <select
              id={`${id}-district`}
              className={FIELD_CLASS}
              value={filters.district_id ?? ''}
              onChange={(e) => onChange(withAreaChange(filters, 'district_id', e.target.value))}
            >
              <option value="">All districts</option>
              {districts.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-circuit`} className={LABEL_CLASS}>
              Circuit
            </label>
            <select
              id={`${id}-circuit`}
              className={FIELD_CLASS}
              value={filters.circuit_id ?? ''}
              disabled={circuits.length === 0}
              onChange={(e) => onChange(withAreaChange(filters, 'circuit_id', e.target.value))}
            >
              <option value="">{circuits.length === 0 ? 'No circuits' : 'All circuits'}</option>
              {circuits.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {!hideSchool && scope.schools.length > 1 && (
        <div>
          <label htmlFor={`${id}-school`} className={LABEL_CLASS}>
            School
          </label>
          <select
            id={`${id}-school`}
            className={FIELD_CLASS}
            value={filters.school_id ?? ''}
            onChange={(e) => onChange(withAreaChange(filters, 'school_id', e.target.value))}
          >
            <option value="">All schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${id}-grade`} className={LABEL_CLASS}>
          Grade
        </label>
        <select
          id={`${id}-grade`}
          className={FIELD_CLASS}
          value={filters.grade ?? ''}
          onChange={(e) => set({ grade: e.target.value || undefined })}
        >
          <option value="">All grades</option>
          {scope.grades.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-year`} className={LABEL_CLASS}>
          Academic year
        </label>
        <select
          id={`${id}-year`}
          className={FIELD_CLASS}
          value={filters.academic_year ?? ''}
          onChange={(e) => set({ academic_year: e.target.value || undefined })}
        >
          <option value="">Current year</option>
          {scope.academic_years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-term`} className={LABEL_CLASS}>
          Term
        </label>
        <select
          id={`${id}-term`}
          className={FIELD_CLASS}
          value={filters.term ?? ''}
          onChange={(e) => set({ term: e.target.value || undefined })}
        >
          <option value="">Whole year</option>
          {scope.terms.map((term) => (
            <option key={term} value={String(term)}>
              Term {term}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-from`} className={LABEL_CLASS}>
          From
        </label>
        <input
          id={`${id}-from`}
          type="date"
          className={FIELD_CLASS}
          value={filters.start_date ?? ''}
          max={filters.end_date}
          onChange={(e) => set({ start_date: e.target.value || undefined })}
        />
      </div>
      <div>
        <label htmlFor={`${id}-to`} className={LABEL_CLASS}>
          To
        </label>
        <input
          id={`${id}-to`}
          type="date"
          className={FIELD_CLASS}
          value={filters.end_date ?? ''}
          min={filters.start_date}
          onChange={(e) => set({ end_date: e.target.value || undefined })}
        />
      </div>
      {hasFilters && (
        <div className="col-span-2 flex items-end lg:col-span-1">
          <Button type="button" variant="ghost" onClick={() => onChange({})}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
