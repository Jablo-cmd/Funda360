import type {
  AttentionReason,
  DataQualityIssues,
  GovernmentReport,
  GovernmentSchoolRow,
} from '@/features/government/types/government.types';

/**
 * The report catalogue. One definition drives the on-screen table, the CSV
 * and Excel-compatible CSV export, and the PDF, so the four can never
 * disagree. These are Funda360 report layouts; none of them is an official
 * government return format.
 */

export type CellValue = string | number | null;

export interface ReportColumn {
  key: string;
  header: string;
  /** Right-align numbers on screen and in the PDF. */
  numeric?: boolean;
}

export interface ReportTable {
  columns: ReportColumn[];
  rows: Record<string, CellValue>[];
}

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  build: (report: GovernmentReport) => ReportTable;
}

export const ATTENTION_LABELS: Record<AttentionReason, string> = {
  low_attendance: 'Low attendance',
  low_performance: 'Low performance',
  overdue_interventions: 'Overdue interventions',
  data_quality: 'Data quality',
};

const DATA_QUALITY_LABELS: Record<keyof DataQualityIssues, string> = {
  missing_emis_number: 'No EMIS number',
  not_linked_to_area: 'Not linked to a district or circuit',
  no_academic_year: 'No academic year for the period',
  period_not_configured: 'Requested term not configured',
  learners_not_enrolled: 'Learners not enrolled in a class',
  classes_without_attendance: 'Classes with no attendance recorded',
  classes_without_assessments: 'Classes with no assessments',
  assessments_missing_marks: 'Assessments with missing marks',
};

/** Human-readable data-quality issues for one school, e.g. "Classes with no attendance recorded (3)". */
export function describeDataQuality(issues: DataQualityIssues): string[] {
  return (Object.entries(issues) as [keyof DataQualityIssues, boolean | number | undefined][])
    .filter(([, value]) => value !== undefined && value !== false && value !== 0)
    .map(([key, value]) => (typeof value === 'number' ? `${DATA_QUALITY_LABELS[key]} (${value})` : DATA_QUALITY_LABELS[key]));
}

/** "86.7%" or an em dash when there is nothing to compute it from. */
export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(1)}%`;
}

function areaLabel(row: GovernmentSchoolRow): string {
  return [row.district, row.circuit].filter(Boolean).join(' / ') || 'Not linked';
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'school_summary',
    title: 'School summary',
    description: 'One row per school: enrolment, educators, attendance, performance and issues needing attention.',
    build: (report) => ({
      columns: [
        { key: 'school', header: 'School' },
        { key: 'emis', header: 'EMIS number' },
        { key: 'area', header: 'District / circuit' },
        { key: 'learners', header: 'Learners enrolled', numeric: true },
        { key: 'educators', header: 'Educators', numeric: true },
        { key: 'ratio', header: 'Learners per educator', numeric: true },
        { key: 'attendance', header: 'Attendance %', numeric: true },
        { key: 'average', header: 'Average mark %', numeric: true },
        { key: 'pass', header: 'Pass rate %', numeric: true },
        { key: 'attention', header: 'Needs attention' },
      ],
      rows: report.schools.map((s) => ({
        school: s.name,
        emis: s.emis_number,
        area: areaLabel(s),
        learners: s.learners_enrolled,
        educators: s.educators,
        ratio: s.learner_educator_ratio,
        attendance: s.attendance_rate,
        average: s.average_percent,
        pass: s.pass_rate,
        attention: s.attention.map((a) => ATTENTION_LABELS[a]).join('; ') || null,
      })),
    }),
  },
  {
    id: 'enrolment_staffing',
    title: 'Enrolment and staffing',
    description: 'Learners on the register, learners enrolled for the period, educators, all staff and classes per school.',
    build: (report) => ({
      columns: [
        { key: 'school', header: 'School' },
        { key: 'emis', header: 'EMIS number' },
        { key: 'year', header: 'Academic year' },
        { key: 'register', header: 'Learners on register', numeric: true },
        { key: 'enrolled', header: 'Learners enrolled', numeric: true },
        { key: 'classes', header: 'Classes', numeric: true },
        { key: 'educators', header: 'Educators', numeric: true },
        { key: 'staff', header: 'All staff', numeric: true },
        { key: 'ratio', header: 'Learners per educator', numeric: true },
      ],
      rows: report.schools.map((s) => ({
        school: s.name,
        emis: s.emis_number,
        year: s.academic_year,
        register: s.learners_active,
        enrolled: s.learners_enrolled,
        classes: s.classes,
        educators: s.educators,
        staff: s.staff,
        ratio: s.learner_educator_ratio,
      })),
    }),
  },
  {
    id: 'attendance',
    title: 'Attendance',
    description: 'Attendance rate per school for the period: (present + late) / (present + late + absent). Excused days are excluded.',
    build: (report) => ({
      columns: [
        { key: 'school', header: 'School' },
        { key: 'area', header: 'District / circuit' },
        { key: 'from', header: 'Period start' },
        { key: 'to', header: 'Period end' },
        { key: 'records', header: 'Qualifying records', numeric: true },
        { key: 'rate', header: 'Attendance %', numeric: true },
        { key: 'below', header: `Below ${report.thresholds.attendance}%` },
      ],
      rows: report.schools.map((s) => ({
        school: s.name,
        area: areaLabel(s),
        from: s.period_start,
        to: s.period_end,
        records: s.attendance_records,
        rate: s.attendance_rate,
        below: s.attendance_rate === null ? null : s.attendance_rate < report.thresholds.attendance ? 'Yes' : 'No',
      })),
    }),
  },
  {
    id: 'performance',
    title: 'Assessment performance',
    description:
      'Average mark and pass rate per school from captured assessment results. Pass means at least the performance threshold.',
    build: (report) => ({
      columns: [
        { key: 'school', header: 'School' },
        { key: 'area', header: 'District / circuit' },
        { key: 'results', header: 'Results captured', numeric: true },
        { key: 'average', header: 'Average mark %', numeric: true },
        { key: 'pass', header: `Pass rate % (≥ ${report.thresholds.performance}%)`, numeric: true },
      ],
      rows: report.schools.map((s) => ({
        school: s.name,
        area: areaLabel(s),
        results: s.assessment_results,
        average: s.average_percent,
        pass: s.pass_rate,
      })),
    }),
  },
  {
    id: 'grade_statistics',
    title: 'Grade statistics',
    description: 'Learners, classes, attendance and performance per grade across the selected schools. Small groups are suppressed.',
    build: (report) => ({
      columns: [
        { key: 'grade', header: 'Grade' },
        { key: 'schools', header: 'Schools', numeric: true },
        { key: 'classes', header: 'Classes', numeric: true },
        { key: 'learners', header: 'Learners', numeric: true },
        { key: 'attendance', header: 'Attendance %', numeric: true },
        { key: 'average', header: 'Average mark %', numeric: true },
        { key: 'pass', header: 'Pass rate %', numeric: true },
        { key: 'note', header: 'Note' },
      ],
      rows: report.grades.map((g) => ({
        grade: g.grade,
        schools: g.schools,
        classes: g.classes,
        learners: g.learners,
        attendance: g.attendance_rate,
        average: g.average_percent,
        pass: g.pass_rate,
        note: g.suppressed ? `Fewer than ${report.thresholds.minimum_group_size} learners; figures withheld` : null,
      })),
    }),
  },
  {
    id: 'subject_performance',
    title: 'Subject performance',
    description: 'Average mark and pass rate per subject across the selected schools.',
    build: (report) => ({
      columns: [
        { key: 'subject', header: 'Subject' },
        { key: 'schools', header: 'Schools', numeric: true },
        { key: 'learners', header: 'Learners', numeric: true },
        { key: 'results', header: 'Results', numeric: true },
        { key: 'average', header: 'Average mark %', numeric: true },
        { key: 'pass', header: 'Pass rate %', numeric: true },
      ],
      rows: report.subjects.map((s) => ({
        subject: s.subject,
        schools: s.schools,
        learners: s.learners,
        results: s.assessment_results,
        average: s.average_percent,
        pass: s.pass_rate,
      })),
    }),
  },
  {
    id: 'district_summary',
    title: 'District summary',
    description: 'Totals and pooled rates per district.',
    build: (report) => ({
      columns: [
        { key: 'province', header: 'Province' },
        { key: 'district', header: 'District' },
        { key: 'schools', header: 'Schools', numeric: true },
        { key: 'learners', header: 'Learners', numeric: true },
        { key: 'educators', header: 'Educators', numeric: true },
        { key: 'attendance', header: 'Attendance %', numeric: true },
        { key: 'average', header: 'Average mark %', numeric: true },
        { key: 'attention', header: 'Schools needing attention', numeric: true },
      ],
      rows: report.areas.map((a) => ({
        province: a.province ?? 'Not linked',
        district: a.district ?? 'Not linked',
        schools: a.schools,
        learners: a.learners,
        educators: a.educators,
        attendance: a.attendance_rate,
        average: a.average_percent,
        attention: a.schools_requiring_attention,
      })),
    }),
  },
  {
    id: 'interventions',
    title: 'Learners and schools requiring intervention',
    description:
      'Learners below the attendance or performance threshold, or with an open intervention; and intervention status per school.',
    build: (report) => ({
      columns: [
        { key: 'school', header: 'School' },
        { key: 'learners', header: 'Learners requiring intervention', numeric: true },
        { key: 'open', header: 'Open', numeric: true },
        { key: 'progress', header: 'In progress', numeric: true },
        { key: 'overdue', header: 'Overdue', numeric: true },
        { key: 'resolved', header: 'Resolved in period', numeric: true },
        { key: 'attention', header: 'Needs attention' },
      ],
      rows: report.schools.map((s) => ({
        school: s.name,
        learners: s.learners_requiring_intervention,
        open: s.interventions.open,
        progress: s.interventions.in_progress,
        overdue: s.interventions.overdue,
        resolved: s.interventions.resolved,
        attention: s.attention.map((a) => ATTENTION_LABELS[a]).join('; ') || null,
      })),
    }),
  },
  {
    id: 'data_quality',
    title: 'Reporting completeness and data quality',
    description: 'Missing or incomplete information that weakens the figures in the other reports.',
    build: (report) => ({
      columns: [
        { key: 'school', header: 'School' },
        { key: 'count', header: 'Issues', numeric: true },
        { key: 'issues', header: 'Details' },
      ],
      rows: report.schools.map((s) => {
        const issues = describeDataQuality(s.data_quality);
        return { school: s.name, count: issues.length, issues: issues.join('; ') || 'None' };
      }),
    }),
  },
  {
    id: 'trends',
    title: 'Trends over time',
    description: 'Weekly attendance rate and monthly average mark across the selected schools.',
    build: (report) => {
      const periods = new Map<string, Record<string, CellValue>>();
      for (const point of report.attendance_trend) {
        periods.set(point.period, { period: point.period, attendance: point.attendance_rate, records: point.records });
      }
      for (const point of report.performance_trend) {
        const row = periods.get(point.period) ?? { period: point.period };
        periods.set(point.period, { ...row, average: point.average_percent, results: point.results });
      }
      return {
        columns: [
          { key: 'period', header: 'Week / month starting' },
          { key: 'attendance', header: 'Attendance %', numeric: true },
          { key: 'records', header: 'Attendance records', numeric: true },
          { key: 'average', header: 'Average mark %', numeric: true },
          { key: 'results', header: 'Results', numeric: true },
        ],
        rows: [...periods.values()].sort((a, b) => String(a.period).localeCompare(String(b.period))),
      };
    },
  },
];

export function findReportDefinition(id: string | null | undefined): ReportDefinition {
  return REPORT_DEFINITIONS.find((definition) => definition.id === id) ?? REPORT_DEFINITIONS[0]!;
}
