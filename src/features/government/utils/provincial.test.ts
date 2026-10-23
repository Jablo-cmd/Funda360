import { describe, expect, it } from 'vitest';
import type {
  ProvincialDistrictRow,
  ProvincialReport,
} from '@/features/government/types/government.types';
import {
  describeIssueCounts,
  districtComparisonTable,
  hasSufficientTrend,
  interventionWorkload,
  provincialDataQualityTable,
  sortDistricts,
} from '@/features/government/utils/provincial';

function district(overrides: Partial<ProvincialDistrictRow>): ProvincialDistrictRow {
  return {
    district_id: 'd',
    district: 'District',
    code: null,
    circuits: 0,
    schools: 1,
    learners_enrolled: 100,
    learners_active: 100,
    educators: 5,
    staff: 6,
    classes: 4,
    attendance_rate: 90,
    attendance_records: 1000,
    average_percent: 60,
    assessment_results: 50,
    learners_requiring_intervention: 3,
    interventions: { open: 1, in_progress: 1, overdue: 0, resolved: 2 },
    schools_requiring_attention: 0,
    schools_with_data_quality_issues: 0,
    data_quality_issues: 0,
    requires_attention: false,
    attention: [],
    insufficient_data: false,
    ...overrides,
  };
}

const north = district({
  district_id: 'n',
  district: 'North',
  attendance_rate: 70,
  average_percent: null,
  learners_enrolled: 50,
});
const south = district({
  district_id: 's',
  district: 'South',
  requires_attention: true,
  attention: ['low_attendance', 'overdue_interventions'],
  attendance_rate: 60,
  data_quality_issues: 4,
  interventions: { open: 5, in_progress: 2, overdue: 3, resolved: 0 },
});
const east = district({
  district_id: 'e',
  district: 'East',
  attendance_rate: null,
  average_percent: 40,
  insufficient_data: true,
});

describe('provincial district comparison', () => {
  it('sorts districts needing attention first, then by name', () => {
    expect(sortDistricts([north, south, east], 'attention').map((d) => d.district)).toEqual([
      'South',
      'East',
      'North',
    ]);
  });

  it('puts missing rates last when sorting by a rate', () => {
    expect(sortDistricts([east, north, south], 'attendance').map((d) => d.district)).toEqual([
      'South',
      'North',
      'East',
    ]);
    expect(sortDistricts([east, north, south], 'performance').map((d) => d.district)).toEqual([
      'East',
      'South',
      'North',
    ]);
  });

  it('sorts by intervention workload, data quality and learners', () => {
    expect(sortDistricts([north, south, east], 'interventions')[0]?.district).toBe('South');
    expect(sortDistricts([north, south, east], 'data_quality')[0]?.district).toBe('South');
    expect(sortDistricts([north, south, east], 'learners').map((d) => d.district)).toEqual([
      'East',
      'South',
      'North',
    ]);
    expect(sortDistricts([south, north], 'name').map((d) => d.district)).toEqual([
      'North',
      'South',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [north, south];
    sortDistricts(input, 'name');
    expect(input.map((d) => d.district)).toEqual(['North', 'South']);
  });

  it('counts open and in-progress interventions as workload', () => {
    expect(interventionWorkload(south)).toBe(7);
  });

  it('needs at least two periods for a trend', () => {
    expect(hasSufficientTrend([])).toBe(false);
    expect(hasSufficientTrend([{}])).toBe(false);
    expect(hasSufficientTrend([{}, {}])).toBe(true);
  });
});

const report = {
  districts: [
    south,
    district({ district_id: 'x', district: 'Empty', schools: 0, insufficient_data: true }),
  ],
  data_quality: {
    issue_counts: {
      missing_emis_number: { schools: 2, total: 2 },
      classes_without_attendance: { schools: 3, total: 9 },
    },
    schools: [
      {
        id: 's1',
        name: 'School One',
        district_id: 's',
        district: 'South',
        circuit: null,
        issues: { missing_emis_number: true, classes_without_attendance: 4 },
      },
    ],
    unlinked_schools: null,
  },
} as unknown as ProvincialReport;

describe('provincial exports', () => {
  it('builds the district comparison table with notes for empty and insufficient data', () => {
    const table = districtComparisonTable(report);
    expect(table.columns.map((c) => c.key)).toContain('workload');
    expect(table.rows[0]).toMatchObject({
      district: 'South',
      workload: 7,
      overdue: 3,
      attendance: 60,
      note: null,
    });
    expect(table.rows[1]).toMatchObject({ district: 'Empty', note: 'No linked schools' });
  });

  it('lists one data-quality row per school and issue', () => {
    const table = provincialDataQualityTable(report);
    expect(table.rows).toEqual([
      {
        district: 'South',
        circuit: null,
        school: 'School One',
        issue: 'No EMIS number',
        count: null,
      },
      {
        district: 'South',
        circuit: null,
        school: 'School One',
        issue: 'Classes with no attendance recorded',
        count: 4,
      },
    ]);
  });

  it('describes issue counts, most widespread first', () => {
    expect(describeIssueCounts(report.data_quality.issue_counts)).toEqual([
      'Classes with no attendance recorded: 3 schools (9)',
      'No EMIS number: 2 schools',
    ]);
  });
});
