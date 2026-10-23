import type { GovernmentReportFilters, ReportingArea } from '@/features/government/types/government.types';

/**
 * Filters live in the URL so a report can be bookmarked or shared. The URL
 * only ever narrows: the database rejects any id outside the caller's
 * scope, whatever the URL says.
 */

export const FILTER_KEYS = [
  'province_id',
  'district_id',
  'circuit_id',
  'school_id',
  'grade',
  'academic_year',
  'term',
  'start_date',
  'end_date',
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValid(key: FilterKey, value: string): boolean {
  switch (key) {
    case 'province_id':
    case 'district_id':
    case 'circuit_id':
    case 'school_id':
      return UUID.test(value);
    case 'start_date':
    case 'end_date':
      return ISO_DATE.test(value);
    case 'term':
      return /^[1-9]\d?$/.test(value);
    case 'grade':
    case 'academic_year':
      return value.length > 0 && value.length <= 80;
  }
}

/** Reads filters from URL search params, dropping anything malformed. */
export function filtersFromSearchParams(params: URLSearchParams): GovernmentReportFilters {
  const filters: GovernmentReportFilters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key)?.trim();
    if (value && isValid(key, value)) filters[key] = value;
  }
  return filters;
}

export function filtersToSearchParams(filters: GovernmentReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params;
}

/** Drops empty values so the RPC receives only real filters. */
export function compactFilters(filters: GovernmentReportFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value as string | number;
  }
  return out;
}

/**
 * Changing a broader area clears the narrower selections beneath it, so a
 * district from one province can never be combined with another province.
 */
export function withAreaChange(
  filters: GovernmentReportFilters,
  key: 'province_id' | 'district_id' | 'circuit_id' | 'school_id',
  value: string,
): GovernmentReportFilters {
  const next: GovernmentReportFilters = { ...filters, [key]: value || undefined };
  if (key === 'province_id') {
    delete next.district_id;
    delete next.circuit_id;
    delete next.school_id;
  } else if (key === 'district_id') {
    delete next.circuit_id;
    delete next.school_id;
  } else if (key === 'circuit_id') {
    delete next.school_id;
  }
  return next;
}

/** Areas of one level, limited to children of the selected parent when there is one. */
export function areasForLevel(
  areas: ReportingArea[],
  level: ReportingArea['level'],
  parentId: string | undefined,
): ReportingArea[] {
  return areas
    .filter((area) => area.level === level && (!parentId || area.parent_id === parentId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every area id at or beneath `areaId`. */
export function descendantAreaIds(areas: ReportingArea[], areaId: string): Set<string> {
  const ids = new Set<string>([areaId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const area of areas) {
      if (area.parent_id && ids.has(area.parent_id) && !ids.has(area.id)) {
        ids.add(area.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** A short human description of the active filters, for report headers and exports. */
export function describeFilters(
  filters: GovernmentReportFilters,
  lookup: { areaName: (id: string) => string | undefined; schoolName: (id: string) => string | undefined },
): string {
  const parts: string[] = [];
  const area = filters.circuit_id ?? filters.district_id ?? filters.province_id;
  if (area) parts.push(lookup.areaName(area) ?? 'Selected area');
  if (filters.school_id) parts.push(lookup.schoolName(filters.school_id) ?? 'Selected school');
  if (filters.grade) parts.push(filters.grade);
  if (filters.academic_year) parts.push(`Academic year ${filters.academic_year}`);
  if (filters.term) parts.push(`Term ${filters.term}`);
  if (filters.start_date || filters.end_date) {
    parts.push(`${filters.start_date ?? 'start'} to ${filters.end_date ?? 'today'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'All schools in your scope · current academic year';
}
