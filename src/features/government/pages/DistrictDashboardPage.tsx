import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { AttendanceTrendChart } from '@/features/reports/components/AttendanceTrendChart';
import { usePermissions } from '@/hooks/usePermissions';
import { KpiTile } from '@/features/government/components/KpiTile';
import { toneForRate } from '@/features/government/utils/kpiTone';
import { AttentionPills } from '@/features/government/components/AttentionPills';
import { ReportFiltersBar } from '@/features/government/components/ReportFiltersBar';
import { useGovernmentReport, useReportingScope } from '@/features/government/hooks/useGovernmentReports';
import { useReportFilters } from '@/features/government/hooks/useReportFilters';
import { describeFilters } from '@/features/government/utils/reportFilters';
import { describeDataQuality, formatPercent } from '@/features/government/utils/reportDefinitions';
import type {
  GovernmentGradeRow,
  GovernmentReport,
  GovernmentSchoolRow,
  GovernmentSubjectRow,
  ReportingCallerKind,
} from '@/features/government/types/government.types';

const TITLE: Record<ReportingCallerKind, string> = {
  official: 'District dashboard',
  platform: 'District dashboard',
  school: 'School reporting dashboard',
};

const count = (value: number) => value.toLocaleString('en-ZA');

/** Schools needing attention first, then by attendance (lowest first). */
function sortSchools(rows: GovernmentSchoolRow[]): GovernmentSchoolRow[] {
  return [...rows].sort(
    (a, b) =>
      b.attention.length - a.attention.length ||
      (a.attendance_rate ?? 101) - (b.attendance_rate ?? 101) ||
      a.name.localeCompare(b.name),
  );
}

export function DistrictDashboardPage() {
  const [filters, setFilters, filterQuery] = useReportFilters();
  const scope = useReportingScope();
  const report = useGovernmentReport(filters, scope.data !== null);
  const { can } = usePermissions();

  const lookups = useMemo(
    () => ({
      areaName: (id: string) => scope.data?.areas.find((a) => a.id === id)?.name,
      schoolName: (id: string) => scope.data?.schools.find((s) => s.id === id)?.name,
    }),
    [scope.data],
  );

  if (scope.isLoading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading your reporting scope…" />
      </PageContainer>
    );
  }
  if (scope.error || !scope.data) {
    return (
      <PageContainer>
        <PageHeader title="District dashboard" />
        <ErrorAlert message={scope.error ?? 'You do not have reporting access.'} />
      </PageContainer>
    );
  }

  const data = report.data;
  return (
    <PageContainer>
      <PageHeader
        title={TITLE[scope.data.caller_kind]}
        description={describeFilters(filters, lookups)}
        action={
          can('government.view') ? (
            <Link
              to={`/reports/government${filterQuery}`}
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-medium text-content-primary no-underline hover:bg-surface-sunken lg:h-10"
            >
              Open reports
            </Link>
          ) : undefined
        }
      />

      <ReportFiltersBar scope={scope.data} filters={filters} onChange={setFilters} />
      <ErrorAlert message={report.error} />

      {scope.data.schools.length === 0 && (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-6 text-sm text-content-secondary">
          No schools are linked to your reporting area yet. A platform administrator links schools to districts and
          circuits under Education Areas.
        </p>
      )}

      {report.isLoading && !data ? <LoadingBlock label="Calculating figures…" /> : data && <DashboardBody report={data} filterQuery={filterQuery} />}
    </PageContainer>
  );
}

function DashboardBody({ report, filterQuery }: { report: GovernmentReport; filterQuery: string }) {
  const { summary, thresholds } = report;
  const schools = sortSchools(report.schools);
  const concerningAttendance = report.schools
    .filter((s) => s.attendance_rate !== null && s.attendance_rate < thresholds.attendance)
    .sort((a, b) => (a.attendance_rate ?? 0) - (b.attendance_rate ?? 0));
  const overdueSchools = report.schools.filter((s) => s.interventions.overdue > 0);
  const dataQualitySchools = report.schools.filter((s) => describeDataQuality(s.data_quality).length > 0);

  const schoolColumns: DataTableColumn<GovernmentSchoolRow>[] = [
    {
      key: 'name',
      header: 'School',
      render: (s) => (
        <div className="min-w-0">
          <Link to={`/district/schools/${s.id}${filterQuery}`} className="font-medium text-brand-600">
            {s.name}
          </Link>
          <p className="text-xs text-content-tertiary">
            {[s.district, s.circuit].filter(Boolean).join(' / ') || 'Not linked to a district'}
            {s.emis_number ? ` · EMIS ${s.emis_number}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'learners', header: 'Learners', align: 'right', render: (s) => count(s.learners_enrolled) },
    { key: 'educators', header: 'Educators', align: 'right', render: (s) => count(s.educators) },
    { key: 'attendance', header: 'Attendance', align: 'right', render: (s) => formatPercent(s.attendance_rate) },
    { key: 'average', header: 'Average mark', align: 'right', render: (s) => formatPercent(s.average_percent) },
    { key: 'interventions', header: 'Learners at risk', align: 'right', render: (s) => count(s.learners_requiring_intervention) },
    { key: 'status', header: 'Status', render: (s) => <AttentionPills reasons={s.attention} /> },
  ];

  const gradeColumns: DataTableColumn<GovernmentGradeRow>[] = [
    { key: 'grade', header: 'Grade', render: (g) => g.grade },
    { key: 'learners', header: 'Learners', align: 'right', render: (g) => count(g.learners) },
    { key: 'classes', header: 'Classes', align: 'right', render: (g) => count(g.classes) },
    { key: 'attendance', header: 'Attendance', align: 'right', render: (g) => (g.suppressed ? 'Withheld' : formatPercent(g.attendance_rate)) },
    { key: 'average', header: 'Average mark', align: 'right', render: (g) => (g.suppressed ? 'Withheld' : formatPercent(g.average_percent)) },
    { key: 'pass', header: 'Pass rate', align: 'right', render: (g) => (g.suppressed ? 'Withheld' : formatPercent(g.pass_rate)) },
  ];

  const subjectColumns: DataTableColumn<GovernmentSubjectRow>[] = [
    { key: 'subject', header: 'Subject', render: (s) => s.subject },
    { key: 'schools', header: 'Schools', align: 'right', render: (s) => count(s.schools) },
    { key: 'results', header: 'Results', align: 'right', render: (s) => count(s.assessment_results) },
    { key: 'average', header: 'Average mark', align: 'right', render: (s) => (s.suppressed ? 'Withheld' : formatPercent(s.average_percent)) },
    { key: 'pass', header: 'Pass rate', align: 'right', render: (s) => (s.suppressed ? 'Withheld' : formatPercent(s.pass_rate)) },
  ];

  return (
    <>
      <section aria-labelledby="overview-heading" className="flex flex-col gap-3">
        <h2 id="overview-heading" className="text-sm font-semibold uppercase tracking-wider text-content-tertiary">
          Overview
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile label="Schools" value={count(summary.schools)} />
          <KpiTile label="Learners enrolled" value={count(summary.learners_enrolled)} hint={`${count(summary.learners_active)} on school registers`} />
          <KpiTile label="Educators" value={count(summary.educators)} hint={`${count(summary.staff)} staff in total`} />
          <KpiTile label="Classes" value={count(summary.classes)} />
          <KpiTile
            label="Attendance rate"
            value={formatPercent(summary.attendance_rate)}
            tone={toneForRate(summary.attendance_rate, thresholds.attendance)}
            hint={summary.attendance_records > 0 ? `${count(summary.attendance_records)} records · threshold ${thresholds.attendance}%` : 'No attendance recorded'}
          />
          <KpiTile
            label="Average mark"
            value={formatPercent(summary.average_percent)}
            tone={toneForRate(summary.average_percent, thresholds.performance)}
            hint={summary.assessment_results > 0 ? `Pass rate ${formatPercent(summary.pass_rate)} · ${count(summary.assessment_results)} results` : 'No marks captured'}
          />
          <KpiTile
            label="Schools needing attention"
            value={count(summary.schools_requiring_attention)}
            tone={summary.schools_requiring_attention > 0 ? 'warning' : 'neutral'}
          />
          <KpiTile
            label="Learners requiring intervention"
            value={count(summary.learners_requiring_intervention)}
            tone={summary.learners_requiring_intervention > 0 ? 'warning' : 'neutral'}
            hint={`Below ${thresholds.attendance}% attendance or ${thresholds.performance}% average, or with an open intervention`}
          />
        </dl>
      </section>

      <Card title={`Schools (${report.schools.length})`}>
        <DataTable columns={schoolColumns} rows={schools} getRowKey={(s) => s.id} emptyMessage="No schools match these filters." />
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card title="Attendance trend (weekly)">
          <AttendanceTrendChart
            data={report.attendance_trend.map((p) => ({ date: p.period, attendanceRate: p.attendance_rate }))}
            thresholdPercent={thresholds.attendance}
            pointLabel="Week"
          />
          {concerningAttendance.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-content-primary">Schools below {thresholds.attendance}%</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {concerningAttendance.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <Link to={`/district/schools/${s.id}${filterQuery}`} className="min-w-0 break-words text-brand-600">
                      {s.name}
                    </Link>
                    <span className="shrink-0 font-medium tabular-nums text-danger-600">{formatPercent(s.attendance_rate)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card title="Average mark trend (monthly)">
          <AttendanceTrendChart
            data={report.performance_trend.map((p) => ({ date: p.period, attendanceRate: p.average_percent }))}
            thresholdPercent={thresholds.performance}
            seriesLabel="Average mark"
            emptyMessage="No assessment results captured for this period yet."
            pointLabel="Month"
          />
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card title="Grades">
          <DataTable columns={gradeColumns} rows={report.grades} getRowKey={(g) => g.grade} emptyMessage="No enrolled learners for this period." />
          {report.grades.some((g) => g.suppressed) && (
            <p className="text-xs text-content-tertiary">
              Figures for groups of fewer than {thresholds.minimum_group_size} learners are withheld to protect learner privacy.
            </p>
          )}
        </Card>
        <Card title="Subjects">
          <DataTable columns={subjectColumns} rows={report.subjects} getRowKey={(s) => s.subject} emptyMessage="No assessment results for this period." />
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card title="Interventions">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile label="Open" value={count(summary.interventions.open)} />
            <KpiTile label="In progress" value={count(summary.interventions.in_progress)} />
            <KpiTile label="Overdue" value={count(summary.interventions.overdue)} tone={summary.interventions.overdue > 0 ? 'danger' : 'neutral'} />
            <KpiTile label="Resolved in period" value={count(summary.interventions.resolved)} />
          </dl>
          {overdueSchools.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {overdueSchools.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-danger-600">{s.interventions.overdue} overdue</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Data quality (${dataQualitySchools.length} of ${report.schools.length} schools)`}>
          {dataQualitySchools.length === 0 ? (
            <p className="text-sm text-content-secondary">No data-quality issues found for this period.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {dataQualitySchools.map((s) => (
                <li key={s.id}>
                  <p className="font-medium text-content-primary">{s.name}</p>
                  <p className="text-content-secondary">{describeDataQuality(s.data_quality).join(' · ')}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {report.areas.length > 1 && (
        <Card title="Districts">
          <DataTable
            columns={[
              { key: 'district', header: 'District', render: (a) => `${a.district ?? 'Not linked'}${a.province ? ` (${a.province})` : ''}` },
              { key: 'schools', header: 'Schools', align: 'right', render: (a) => count(a.schools) },
              { key: 'learners', header: 'Learners', align: 'right', render: (a) => count(a.learners) },
              { key: 'attendance', header: 'Attendance', align: 'right', render: (a) => formatPercent(a.attendance_rate) },
              { key: 'average', header: 'Average mark', align: 'right', render: (a) => formatPercent(a.average_percent) },
              { key: 'attention', header: 'Needing attention', align: 'right', render: (a) => count(a.schools_requiring_attention) },
            ]}
            rows={report.areas}
            getRowKey={(a) => a.district_id ?? 'unlinked'}
          />
        </Card>
      )}

      <details className="rounded-card border border-border bg-surface-raised p-4 text-sm text-content-secondary">
        <summary className="cursor-pointer font-medium text-content-primary">How these figures are calculated</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>All figures are calculated when you open the page, from the attendance registers, enrolments, assessment marks and intervention records captured in Funda360.</li>
          <li>Attendance rate = (present + late) ÷ (present + late + absent). Excused days and unmarked days are excluded. District rates are pooled across all records, not averages of school averages.</li>
          <li>Average mark = mean of every captured result as a percentage of its maximum mark. Pass rate = results at or above {thresholds.performance}%.</li>
          <li>Educators are active staff with a teaching role or a teaching assignment. Learners enrolled are learners enrolled in a class for the academic year of the period.</li>
          <li>A school needs attention when attendance is below {thresholds.attendance}%, the average mark is below {thresholds.performance}%, an intervention is overdue, or a data-quality issue is found. These thresholds are Funda360 defaults, not official targets.</li>
          <li>Generated {new Date(report.generated_at).toLocaleString('en-ZA')}.</li>
        </ul>
      </details>
    </>
  );
}
