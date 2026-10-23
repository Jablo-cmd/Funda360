import type {
  DataQualityIssues,
  DistrictAttentionReason,
  ProvincialDistrictRow,
  ProvincialReport,
} from '@/features/government/types/government.types';
import {
  DATA_QUALITY_LABELS,
  type ReportTable,
} from '@/features/government/utils/reportDefinitions';

/**
 * Presentation helpers for the Provincial Dashboard. Every figure comes from
 * get_provincial_report(); nothing here recalculates a rate. Sorting is a
 * viewing aid, not a ranking: the dashboard never labels districts as
 * better or worse than each other.
 */

export type DistrictSortKey =
  | 'name'
  | 'attention'
  | 'attendance'
  | 'performance'
  | 'interventions'
  | 'data_quality'
  | 'learners';

export const DISTRICT_SORT_OPTIONS: { value: DistrictSortKey; label: string }[] = [
  { value: 'attention', label: 'Needing attention first' },
  { value: 'name', label: 'District name (A–Z)' },
  { value: 'attendance', label: 'Attendance rate (lowest first)' },
  { value: 'performance', label: 'Average mark (lowest first)' },
  { value: 'interventions', label: 'Intervention workload (highest first)' },
  { value: 'data_quality', label: 'Data-quality issues (most first)' },
  { value: 'learners', label: 'Learners enrolled (most first)' },
];

export const DISTRICT_ATTENTION_LABELS: Record<DistrictAttentionReason, string> = {
  schools_requiring_attention: 'Schools needing attention',
  low_attendance: 'Low attendance',
  low_performance: 'Low performance',
  overdue_interventions: 'Overdue interventions',
};

/** Open + in progress: the interventions still being worked on. */
export function interventionWorkload(row: Pick<ProvincialDistrictRow, 'interventions'>): number {
  return row.interventions.open + row.interventions.in_progress;
}

/** Missing values sort last whatever the direction. */
function compareNullable(a: number | null, b: number | null, ascending: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return ascending ? a - b : b - a;
}

export function sortDistricts(
  rows: ProvincialDistrictRow[],
  key: DistrictSortKey,
): ProvincialDistrictRow[] {
  const byName = (a: ProvincialDistrictRow, b: ProvincialDistrictRow) =>
    a.district.localeCompare(b.district);
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (key) {
      case 'attention':
        return (
          Number(b.requires_attention) - Number(a.requires_attention) ||
          b.attention.length - a.attention.length ||
          byName(a, b)
        );
      case 'attendance':
        return compareNullable(a.attendance_rate, b.attendance_rate, true) || byName(a, b);
      case 'performance':
        return compareNullable(a.average_percent, b.average_percent, true) || byName(a, b);
      case 'interventions':
        return (
          interventionWorkload(b) - interventionWorkload(a) ||
          b.interventions.overdue - a.interventions.overdue ||
          byName(a, b)
        );
      case 'data_quality':
        return b.data_quality_issues - a.data_quality_issues || byName(a, b);
      case 'learners':
        return b.learners_enrolled - a.learners_enrolled || byName(a, b);
      default:
        return byName(a, b);
    }
  });
  return sorted;
}

/** A trend needs at least two periods to say anything. */
export function hasSufficientTrend(points: readonly unknown[]): boolean {
  return points.length >= 2;
}

/** "Classes with no attendance recorded: 4 schools (12)" style lines, most widespread first. */
export function describeIssueCounts(
  counts: ProvincialReport['data_quality']['issue_counts'],
): string[] {
  return (Object.entries(counts) as [keyof DataQualityIssues, { schools: number; total: number }][])
    .sort(
      (a, b) =>
        b[1].schools - a[1].schools ||
        DATA_QUALITY_LABELS[a[0]].localeCompare(DATA_QUALITY_LABELS[b[0]]),
    )
    .map(([key, value]) => {
      const schools = `${value.schools} ${value.schools === 1 ? 'school' : 'schools'}`;
      return value.total !== value.schools
        ? `${DATA_QUALITY_LABELS[key]}: ${schools} (${value.total})`
        : `${DATA_QUALITY_LABELS[key]}: ${schools}`;
    });
}

/** The district comparison as an exportable table (same columns on screen, CSV and PDF). */
export function districtComparisonTable(report: ProvincialReport): ReportTable {
  return {
    columns: [
      { key: 'district', header: 'District' },
      { key: 'circuits', header: 'Circuits', numeric: true },
      { key: 'schools', header: 'Schools', numeric: true },
      { key: 'learners', header: 'Learners enrolled', numeric: true },
      { key: 'educators', header: 'Educators', numeric: true },
      { key: 'attendance', header: 'Attendance %', numeric: true },
      { key: 'average', header: 'Average mark %', numeric: true },
      { key: 'at_risk', header: 'Learners requiring intervention', numeric: true },
      { key: 'workload', header: 'Open interventions', numeric: true },
      { key: 'overdue', header: 'Overdue interventions', numeric: true },
      { key: 'attention', header: 'Schools requiring attention', numeric: true },
      { key: 'data_quality', header: 'Data-quality issues', numeric: true },
      { key: 'note', header: 'Note' },
    ],
    rows: report.districts.map((d) => ({
      district: d.district,
      circuits: d.circuits,
      schools: d.schools,
      learners: d.learners_enrolled,
      educators: d.educators,
      attendance: d.attendance_rate,
      average: d.average_percent,
      at_risk: d.learners_requiring_intervention,
      workload: interventionWorkload(d),
      overdue: d.interventions.overdue,
      attention: d.schools_requiring_attention,
      data_quality: d.data_quality_issues,
      note:
        d.schools === 0 ? 'No linked schools' : d.insufficient_data ? 'No sufficient data' : null,
    })),
  };
}

export function provincialDataQualityTable(report: ProvincialReport): ReportTable {
  const rows = report.data_quality.schools.flatMap((school) =>
    (Object.entries(school.issues) as [keyof DataQualityIssues, boolean | number][]).map(
      ([key, value]) => ({
        district: school.district,
        circuit: school.circuit,
        school: school.name,
        issue: DATA_QUALITY_LABELS[key],
        count: typeof value === 'number' ? value : null,
      }),
    ),
  );
  return {
    columns: [
      { key: 'district', header: 'District' },
      { key: 'circuit', header: 'Circuit' },
      { key: 'school', header: 'School' },
      { key: 'issue', header: 'Issue' },
      { key: 'count', header: 'Count', numeric: true },
    ],
    rows,
  };
}
