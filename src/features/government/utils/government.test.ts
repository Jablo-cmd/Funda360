import { describe, expect, it } from 'vitest';
import {
  areasForLevel,
  compactFilters,
  describeFilters,
  descendantAreaIds,
  filtersFromSearchParams,
  filtersToSearchParams,
  withAreaChange,
} from '@/features/government/utils/reportFilters';
import {
  REPORT_DEFINITIONS,
  describeDataQuality,
  findReportDefinition,
  formatPercent,
} from '@/features/government/utils/reportDefinitions';
import { exportFilename, reportToCsv, reportToExcelCsv } from '@/features/government/utils/reportExport';
import { toneForRate } from '@/features/government/utils/kpiTone';
import { resolveNavForRole } from '@/features/rbac/constants/navigation';
import { resolveDashboardPersona } from '@/features/dashboard/resolveDashboardPersona';
import { hasPermission } from '@/features/rbac/utils/permissionHelpers';
import type { GovernmentReport, ReportingArea } from '@/features/government/types/government.types';

const SCHOOL_ID = '11111111-2222-3333-4444-555555555555';
const DISTRICT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const AREAS: ReportingArea[] = [
  { id: 'p1', level: 'province', parent_id: null, name: 'Province One', code: null },
  { id: 'd1', level: 'district', parent_id: 'p1', name: 'District One', code: null },
  { id: 'd2', level: 'district', parent_id: 'p1', name: 'District Two', code: null },
  { id: 'c1', level: 'circuit', parent_id: 'd1', name: 'Circuit One', code: null },
  { id: 'p2', level: 'province', parent_id: null, name: 'Province Two', code: null },
];

function makeReport(overrides: Partial<GovernmentReport> = {}): GovernmentReport {
  return {
    generated_at: '2026-10-08T08:00:00Z',
    filters: {},
    thresholds: { attendance: 80, performance: 50, minimum_group_size: 5 },
    summary: {
      schools: 1,
      learners_active: 10,
      learners_enrolled: 6,
      educators: 1,
      staff: 2,
      classes: 1,
      attendance_rate: 86.7,
      attendance_records: 30,
      average_percent: 70,
      pass_rate: 83.3,
      assessment_results: 6,
      learners_requiring_intervention: 1,
      schools_requiring_attention: 1,
      schools_with_data_quality_issues: 0,
      interventions: { open: 1, in_progress: 0, overdue: 1, resolved: 0 },
    },
    schools: [
      {
        id: SCHOOL_ID,
        name: '=HYPERLINK("x") School',
        emis_number: '900000001',
        status: 'active',
        province: 'Province One',
        district_id: 'd1',
        district: 'District One',
        circuit_id: 'c1',
        circuit: 'Circuit One',
        academic_year: '2026',
        period_start: '2026-01-12',
        period_end: '2026-03-27',
        learners_active: 10,
        learners_enrolled: 6,
        educators: 1,
        staff: 2,
        classes: 1,
        learner_educator_ratio: 6,
        attendance_rate: 75.5,
        attendance_records: 30,
        average_percent: 70,
        pass_rate: 83.3,
        assessment_results: 6,
        learners_requiring_intervention: 1,
        interventions: { open: 1, in_progress: 0, overdue: 1, resolved: 0 },
        data_quality: { classes_without_attendance: 2, missing_emis_number: true },
        attention: ['low_attendance', 'overdue_interventions'],
        learner_detail: false,
      },
    ],
    areas: [],
    grades: [
      {
        grade: 'Grade 10',
        learners: 3,
        schools: 1,
        classes: 1,
        suppressed: true,
        attendance_rate: null,
        average_percent: null,
        pass_rate: null,
        assessment_results: 3,
      },
    ],
    subjects: [],
    attendance_trend: [{ period: '2026-02-02', attendance_rate: 86.7, records: 30 }],
    performance_trend: [{ period: '2026-03-01', average_percent: 70, results: 6 }],
    ...overrides,
  };
}

describe('report filters', () => {
  it('reads valid filters from the URL and drops malformed ones', () => {
    const params = new URLSearchParams({
      school_id: SCHOOL_ID,
      district_id: "' or 1=1 --",
      start_date: '2026-02-01',
      end_date: 'yesterday',
      term: '2',
      grade: 'Grade 10',
    });
    expect(filtersFromSearchParams(params)).toEqual({
      school_id: SCHOOL_ID,
      start_date: '2026-02-01',
      term: '2',
      grade: 'Grade 10',
    });
  });

  it('round-trips through search params', () => {
    const filters = { district_id: DISTRICT_ID, academic_year: '2026', term: '1' };
    expect(filtersFromSearchParams(filtersToSearchParams(filters))).toEqual(filters);
  });

  it('sends only non-empty filters to the database', () => {
    expect(compactFilters({ school_id: '', grade: 'Grade 8', term: undefined })).toEqual({ grade: 'Grade 8' });
  });

  it('clears narrower selections when a broader area changes', () => {
    const start = { province_id: 'p1', district_id: 'd1', circuit_id: 'c1', school_id: SCHOOL_ID, grade: 'Grade 8' };
    expect(withAreaChange(start, 'province_id', 'p2')).toEqual({ province_id: 'p2', grade: 'Grade 8' });
    expect(withAreaChange(start, 'district_id', 'd2')).toEqual({ province_id: 'p1', district_id: 'd2', grade: 'Grade 8' });
    expect(withAreaChange(start, 'school_id', '')).toEqual({ ...start, school_id: undefined });
  });

  it('lists areas of a level under the selected parent', () => {
    expect(areasForLevel(AREAS, 'district', 'p1').map((a) => a.id)).toEqual(['d1', 'd2']);
    expect(areasForLevel(AREAS, 'district', 'p2')).toEqual([]);
    expect(areasForLevel(AREAS, 'province', undefined).map((a) => a.id)).toEqual(['p1', 'p2']);
  });

  it('finds every area beneath an area', () => {
    expect([...descendantAreaIds(AREAS, 'p1')].sort()).toEqual(['c1', 'd1', 'd2', 'p1']);
    expect([...descendantAreaIds(AREAS, 'd2')]).toEqual(['d2']);
  });

  it('describes the active filters in words', () => {
    const lookup = { areaName: (id: string) => AREAS.find((a) => a.id === id)?.name, schoolName: () => 'School X' };
    expect(describeFilters({ district_id: 'd1', term: '2', academic_year: '2026' }, lookup)).toBe(
      'District One · Academic year 2026 · Term 2',
    );
    expect(describeFilters({}, lookup)).toBe('All schools in your scope · current academic year');
  });
});

describe('report definitions', () => {
  it('every report builds a table whose rows only use declared columns', () => {
    const report = makeReport();
    for (const definition of REPORT_DEFINITIONS) {
      const table = definition.build(report);
      const keys = new Set(table.columns.map((c) => c.key));
      for (const row of table.rows) {
        for (const key of Object.keys(row)) expect(keys.has(key)).toBe(true);
      }
    }
  });

  it('every report handles an empty dataset', () => {
    const empty = makeReport({ schools: [], grades: [], subjects: [], areas: [], attendance_trend: [], performance_trend: [] });
    for (const definition of REPORT_DEFINITIONS) {
      expect(definition.build(empty).rows).toEqual([]);
    }
  });

  it('takes school figures straight from the report data', () => {
    const table = findReportDefinition('school_summary').build(makeReport());
    expect(table.rows[0]).toMatchObject({
      emis: '900000001',
      area: 'District One / Circuit One',
      learners: 6,
      attendance: 75.5,
      attention: 'Low attendance; Overdue interventions',
    });
  });

  it('marks attendance below the threshold', () => {
    const table = findReportDefinition('attendance').build(makeReport());
    expect(table.rows[0]?.below).toBe('Yes');
  });

  it('labels suppressed grade figures', () => {
    const table = findReportDefinition('grade_statistics').build(makeReport());
    expect(table.rows[0]).toMatchObject({ attendance: null, note: 'Fewer than 5 learners; figures withheld' });
  });

  it('merges weekly attendance and monthly marks into one time series', () => {
    const table = findReportDefinition('trends').build(makeReport());
    expect(table.rows.map((r) => r.period)).toEqual(['2026-02-02', '2026-03-01']);
  });

  it('falls back to the first report for an unknown id', () => {
    expect(findReportDefinition('nope').id).toBe(REPORT_DEFINITIONS[0]!.id);
  });

  it('describes data-quality issues in words', () => {
    expect(describeDataQuality({ classes_without_attendance: 2, missing_emis_number: true, learners_not_enrolled: 0 })).toEqual([
      'Classes with no attendance recorded (2)',
      'No EMIS number',
    ]);
  });

  it('formats rates and missing rates', () => {
    expect(formatPercent(86.66)).toBe('86.7%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('report exports', () => {
  const table = findReportDefinition('school_summary').build(makeReport());

  it('CSV neutralises spreadsheet formulas in school names', () => {
    const csv = reportToCsv(table);
    expect(csv.split('\r\n')[0]).toContain('School,EMIS number');
    expect(csv).toContain(`"'=HYPERLINK(""x"") School"`);
  });

  it('Excel CSV starts with a byte-order mark and states it is not an official format', () => {
    const csv = reportToExcelCsv(table, {
      title: 'School summary',
      description: 'd',
      scope: 'District One',
      generatedAt: '8 Oct 2026',
      generatedBy: 'official@department.test',
    });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('not an official government return format');
    expect(csv).toContain('School,EMIS number');
  });

  it('builds dated file names', () => {
    expect(exportFilename('school_summary', 'pdf', new Date('2026-10-08T10:00:00Z'))).toBe('funda360-school-summary-2026-10-08.pdf');
  });
});

describe('status tones', () => {
  it('flags rates below the threshold and close to it', () => {
    expect(toneForRate(null, 80)).toBe('neutral');
    expect(toneForRate(79.9, 80)).toBe('danger');
    expect(toneForRate(82, 80)).toBe('warning');
    expect(toneForRate(90, 80)).toBe('good');
  });
});

describe('education official access in the app shell', () => {
  it('sees only the government pages and their own profile', () => {
    const paths = resolveNavForRole('education_official').flatMap((group) => group.items.map((item) => item.path));
    expect(paths).toEqual(['/province', '/district', '/reports/government', '/my-profile']);
  });

  it('lands on the district dashboard', () => {
    expect(resolveDashboardPersona('education_official')).toBe('district');
  });

  it('can view and export reports but not manage areas or school data', () => {
    expect(hasPermission('education_official', 'government.view')).toBe(true);
    expect(hasPermission('education_official', 'government.export')).toBe(true);
    expect(hasPermission('education_official', 'government.manage')).toBe(false);
    expect(hasPermission('education_official', 'learner.view')).toBe(false);
    expect(hasPermission('education_official', 'tenant.switch')).toBe(false);
  });

  it('only platform administrators manage education areas', () => {
    expect(hasPermission('platform_owner', 'government.manage')).toBe(true);
    expect(hasPermission('principal', 'government.manage')).toBe(false);
    expect(hasPermission('principal', 'government.view')).toBe(true);
    expect(hasPermission('teacher', 'government.view')).toBe(false);
  });
});
