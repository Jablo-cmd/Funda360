import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { AttendanceTrendChart } from '@/features/reports/components/AttendanceTrendChart';
import { useAuth } from '@/features/auth/context/authContext';
import { KpiTile } from '@/features/government/components/KpiTile';
import { toneForRate } from '@/features/government/utils/kpiTone';
import { ReportFiltersBar } from '@/features/government/components/ReportFiltersBar';
import { ReportExportButtons } from '@/features/government/components/ReportExportButtons';
import {
  useProvincialReport,
  useProvincialScope,
  useReportingScope,
} from '@/features/government/hooks/useGovernmentReports';
import { useReportFilters } from '@/features/government/hooks/useReportFilters';
import { governmentReportService } from '@/features/government/services/governmentReportService';
import { describeFilters, filtersToSearchParams } from '@/features/government/utils/reportFilters';
import { describeDataQuality, formatPercent } from '@/features/government/utils/reportDefinitions';
import {
  DISTRICT_ATTENTION_LABELS,
  DISTRICT_SORT_OPTIONS,
  describeIssueCounts,
  districtComparisonTable,
  hasSufficientTrend,
  interventionWorkload,
  provincialDataQualityTable,
  sortDistricts,
  type DistrictSortKey,
} from '@/features/government/utils/provincial';
import type {
  ExportFormat,
  GovernmentReportFilters,
  ProvincialDistrictRow,
  ProvincialReport,
} from '@/features/government/types/government.types';

const count = (value: number) => value.toLocaleString('en-ZA');
const FIELD_CLASS =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary lg:h-10';

/** Filters for a district drill-down: the province plus the period filters, narrowed to one district. */
function districtQuery(filters: GovernmentReportFilters, districtId: string): string {
  const params = filtersToSearchParams({
    ...filters,
    district_id: districtId,
    circuit_id: undefined,
    school_id: undefined,
  });
  return `?${params.toString()}`;
}

/**
 * Provincial Dashboard. Province-level access is checked in the database
 * (get_provincial_report): a district or circuit official who opens this
 * URL gets no provinces and no data. Filters only narrow the province.
 */
export function ProvincialDashboardPage() {
  const [filters, setFilters, filterQuery] = useReportFilters();
  const scope = useReportingScope();
  const provinces = useProvincialScope();
  const provinceId = filters.province_id;
  const allowedProvince = provinces.data?.some((p) => p.id === provinceId) ?? false;
  const report = useProvincialReport(allowedProvince ? provinceId : undefined, filters);

  // Open the first province the caller may report on.
  const firstProvince = provinces.data?.[0]?.id;
  useEffect(() => {
    if (!provinceId && firstProvince) setFilters({ ...filters, province_id: firstProvince });
  }, [provinceId, firstProvince, filters, setFilters]);

  const lookups = useMemo(
    () => ({
      areaName: (id: string) => scope.data?.areas.find((a) => a.id === id)?.name,
      schoolName: (id: string) => scope.data?.schools.find((s) => s.id === id)?.name,
    }),
    [scope.data],
  );

  if (scope.isLoading || provinces.isLoading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading your reporting scope…" />
      </PageContainer>
    );
  }
  if (scope.error || provinces.error || !scope.data || !provinces.data) {
    return (
      <PageContainer>
        <PageHeader title="Provincial dashboard" />
        <ErrorAlert
          message={scope.error ?? provinces.error ?? 'You do not have reporting access.'}
        />
      </PageContainer>
    );
  }
  if (provinces.data.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Provincial dashboard" />
        <p className="rounded-card border border-border bg-surface-raised px-4 py-6 text-sm text-content-secondary">
          The provincial dashboard needs province-level access. Your access covers a district,
          circuit or school; use the <Link to="/district">District dashboard</Link> instead. A
          platform administrator grants provincial access under Education Areas.
        </p>
      </PageContainer>
    );
  }

  // Only provinces the caller may open are offered in the province picker.
  const provinceScope = {
    ...scope.data,
    areas: scope.data.areas.filter(
      (a) => a.level !== 'province' || provinces.data!.some((p) => p.id === a.id),
    ),
  };

  return (
    <PageContainer>
      <PageHeader
        title={
          report.data
            ? `${report.data.province.name}: provincial dashboard`
            : 'Provincial dashboard'
        }
        description={describeFilters(filters, lookups)}
        action={
          <Link
            to={`/reports/government${filterQuery}`}
            className="focus-ring inline-flex h-11 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-medium text-content-primary no-underline hover:bg-surface-sunken lg:h-10"
          >
            Open reports
          </Link>
        }
      />

      <ReportFiltersBar
        scope={provinceScope}
        filters={filters}
        onChange={(next) => setFilters({ ...next, province_id: next.province_id ?? provinceId })}
      />
      {provinceId && !allowedProvince && (
        <ErrorAlert message="You do not have province-level access to this province." />
      )}
      <ErrorAlert message={report.error} />

      {report.isLoading && !report.data ? (
        <LoadingBlock label="Calculating provincial figures…" />
      ) : (
        report.data &&
        provinceId && (
          <ProvincialBody report={report.data} provinceId={provinceId} filters={filters} />
        )
      )}
    </PageContainer>
  );
}

function ProvincialBody({
  report,
  provinceId,
  filters,
}: {
  report: ProvincialReport;
  provinceId: string;
  filters: GovernmentReportFilters;
}) {
  const id = useId();
  const { user } = useAuth();
  const [sortKey, setSortKey] = useState<DistrictSortKey>('attention');
  const { summary, thresholds } = report;
  const districts = sortDistricts(report.districts, sortKey);
  const scopeLabel = `${report.province.name}`;
  const generatedAt = new Date(report.generated_at).toLocaleString('en-ZA');
  const recordExport = (reportId: string) => (format: ExportFormat) =>
    governmentReportService.recordProvincialExport(provinceId, reportId, format, filters);

  const districtColumns: DataTableColumn<ProvincialDistrictRow>[] = [
    {
      key: 'district',
      header: 'District',
      render: (d) => (
        <div className="min-w-0">
          <Link
            to={`/district${districtQuery(filters, d.district_id)}`}
            className="font-medium text-brand-600"
          >
            {d.district}
          </Link>
          <p className="text-xs text-content-tertiary">
            {d.circuits > 0
              ? `${d.circuits} ${d.circuits === 1 ? 'circuit' : 'circuits'}`
              : 'No circuits'}
            {d.schools === 0
              ? ' · No linked schools'
              : d.insufficient_data
                ? ' · No sufficient data'
                : ''}
          </p>
        </div>
      ),
    },
    { key: 'schools', header: 'Schools', align: 'right', render: (d) => count(d.schools) },
    {
      key: 'learners',
      header: 'Learners',
      align: 'right',
      render: (d) => count(d.learners_enrolled),
    },
    { key: 'educators', header: 'Educators', align: 'right', render: (d) => count(d.educators) },
    {
      key: 'attendance',
      header: 'Attendance rate',
      align: 'right',
      render: (d) => formatPercent(d.attendance_rate),
    },
    {
      key: 'average',
      header: 'Average mark',
      align: 'right',
      render: (d) => formatPercent(d.average_percent),
    },
    {
      key: 'workload',
      header: 'Intervention workload',
      align: 'right',
      render: (d) =>
        `${count(interventionWorkload(d))}${d.interventions.overdue > 0 ? ` (${d.interventions.overdue} overdue)` : ''}`,
    },
    {
      key: 'attention',
      header: 'Schools requiring attention',
      align: 'right',
      render: (d) => count(d.schools_requiring_attention),
    },
    {
      key: 'dq',
      header: 'Data quality',
      align: 'right',
      render: (d) => count(d.data_quality_issues),
    },
    {
      key: 'flags',
      header: 'Status',
      render: (d) =>
        d.attention.length === 0 ? (
          <span className="text-content-tertiary">No flags</span>
        ) : (
          <ul className="flex flex-col gap-0.5 text-xs">
            {d.attention.map((reason) => (
              <li key={reason}>{DISTRICT_ATTENTION_LABELS[reason]}</li>
            ))}
          </ul>
        ),
    },
  ];

  const comparisonTable = districtComparisonTable({ ...report, districts });
  const dataQualityTable = provincialDataQualityTable(report);
  const issueLines = describeIssueCounts(report.data_quality.issue_counts);

  return (
    <>
      <section aria-labelledby={`${id}-overview`} className="flex flex-col gap-3">
        <h2
          id={`${id}-overview`}
          className="text-sm font-semibold uppercase tracking-wider text-content-tertiary"
        >
          Province overview
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <KpiTile
            label="Schools"
            value={count(summary.schools)}
            hint={`${count(summary.districts)} districts`}
          />
          <KpiTile
            label="Learners enrolled"
            value={count(summary.learners_enrolled)}
            hint={`${count(summary.learners_active)} on school registers`}
          />
          <KpiTile
            label="Educators"
            value={count(summary.educators)}
            hint={`${count(summary.staff)} staff in total`}
          />
          <KpiTile label="Classes" value={count(summary.classes)} />
          <KpiTile
            label="Attendance rate"
            value={formatPercent(summary.attendance_rate)}
            tone={toneForRate(summary.attendance_rate, thresholds.attendance)}
            hint={
              summary.attendance_records > 0
                ? `${count(summary.attendance_records)} records`
                : 'No sufficient data'
            }
          />
          <KpiTile
            label="Average mark"
            value={formatPercent(summary.average_percent)}
            tone={toneForRate(summary.average_percent, thresholds.performance)}
            hint={
              summary.assessment_results > 0
                ? `Pass rate ${formatPercent(summary.pass_rate)}`
                : 'No sufficient data'
            }
          />
          <KpiTile
            label="Schools requiring attention"
            value={count(summary.schools_requiring_attention)}
            tone={summary.schools_requiring_attention > 0 ? 'warning' : 'neutral'}
          />
          <KpiTile
            label="Districts requiring attention"
            value={count(summary.districts_requiring_attention)}
            tone={summary.districts_requiring_attention > 0 ? 'warning' : 'neutral'}
          />
          <KpiTile
            label="Learners requiring intervention"
            value={count(summary.learners_requiring_intervention)}
            tone={summary.learners_requiring_intervention > 0 ? 'warning' : 'neutral'}
          />
          <KpiTile
            label="Open interventions"
            value={count(summary.interventions.open + summary.interventions.in_progress)}
            hint={`${count(summary.interventions.in_progress)} in progress`}
          />
          <KpiTile
            label="Overdue interventions"
            value={count(summary.interventions.overdue)}
            tone={summary.interventions.overdue > 0 ? 'danger' : 'neutral'}
          />
          <KpiTile
            label="Data-quality issues"
            value={count(summary.data_quality_issues)}
            tone={summary.data_quality_issues > 0 ? 'warning' : 'neutral'}
            hint={`${count(summary.schools_with_data_quality_issues)} schools affected`}
          />
        </dl>
      </section>

      <Card title={`District comparison (${report.districts.length})`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full sm:max-w-xs">
            <label
              htmlFor={`${id}-sort`}
              className="mb-1.5 block text-xs font-medium text-content-tertiary"
            >
              Order districts by
            </label>
            <select
              id={`${id}-sort`}
              className={FIELD_CLASS}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as DistrictSortKey)}
            >
              {DISTRICT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <ReportExportButtons
            reportId="provincial_district_comparison"
            table={comparisonTable}
            filters={filters}
            record={recordExport('provincial_district_comparison')}
            meta={{
              title: 'District comparison',
              description:
                'Districts of the province side by side. Not a ranking and not an official return.',
              scope: scopeLabel,
              generatedAt,
              generatedBy: user?.email ?? 'Funda360 user',
            }}
          />
        </div>

        <ul className="flex flex-col gap-3 sm:hidden" aria-label="Districts">
          {districts.map((d) => (
            <li key={d.district_id} className="rounded-md border border-border p-3 text-sm">
              <Link
                to={`/district${districtQuery(filters, d.district_id)}`}
                className="font-medium text-brand-600"
              >
                {d.district}
              </Link>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-content-tertiary">Schools</dt>
                <dd className="text-right tabular-nums">{count(d.schools)}</dd>
                <dt className="text-content-tertiary">Learners</dt>
                <dd className="text-right tabular-nums">{count(d.learners_enrolled)}</dd>
                <dt className="text-content-tertiary">Attendance rate</dt>
                <dd className="text-right tabular-nums">{formatPercent(d.attendance_rate)}</dd>
                <dt className="text-content-tertiary">Average mark</dt>
                <dd className="text-right tabular-nums">{formatPercent(d.average_percent)}</dd>
                <dt className="text-content-tertiary">Intervention workload</dt>
                <dd className="text-right tabular-nums">{count(interventionWorkload(d))}</dd>
                <dt className="text-content-tertiary">Data quality</dt>
                <dd className="text-right tabular-nums">{count(d.data_quality_issues)}</dd>
              </dl>
              <p className="mt-2 text-xs text-content-secondary">
                {d.schools === 0
                  ? 'No linked schools'
                  : d.insufficient_data
                    ? 'No sufficient data'
                    : d.attention.length > 0
                      ? d.attention.map((r) => DISTRICT_ATTENTION_LABELS[r]).join(' · ')
                      : 'No flags'}
              </p>
            </li>
          ))}
        </ul>
        <div className="hidden sm:block">
          <DataTable
            columns={districtColumns}
            rows={districts}
            getRowKey={(d) => d.district_id}
            emptyMessage="No districts are set up for this province yet."
          />
        </div>
        <p className="text-xs text-content-tertiary">
          Districts are shown side by side to help plan support. The order is a viewing choice, not
          a ranking.
        </p>
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card title="Attendance trend (weekly)">
          {hasSufficientTrend(report.attendance_trend) ? (
            <AttendanceTrendChart
              data={report.attendance_trend.map((p) => ({
                date: p.period,
                attendanceRate: p.attendance_rate,
              }))}
              thresholdPercent={thresholds.attendance}
              pointLabel="Week"
            />
          ) : (
            <p className="text-sm text-content-secondary">No sufficient data</p>
          )}
        </Card>
        <Card title="Average mark trend (monthly)">
          {hasSufficientTrend(report.performance_trend) ? (
            <AttendanceTrendChart
              data={report.performance_trend.map((p) => ({
                date: p.period,
                attendanceRate: p.average_percent,
              }))}
              thresholdPercent={thresholds.performance}
              seriesLabel="Average mark"
              pointLabel="Month"
            />
          ) : (
            <p className="text-sm text-content-secondary">No sufficient data</p>
          )}
        </Card>
      </div>

      <Card title="Interventions (monthly)">
        {report.intervention_trend.length === 0 ? (
          <p className="text-sm text-content-secondary">No sufficient data</p>
        ) : (
          <TableScrollContainer>
            <table className="w-full text-sm">
              <caption className="sr-only">Interventions opened and resolved per month</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-content-tertiary">
                  <th scope="col" className="px-4 py-2">
                    Month starting
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Opened
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Resolved
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.intervention_trend.map((t) => (
                  <tr key={t.period} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {t.period}
                    </th>
                    <td className="px-4 py-2 text-right tabular-nums">{count(t.opened)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{count(t.resolved)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </Card>

      <Card
        title={`Data quality (${report.data_quality.schools.length} of ${summary.schools} schools)`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          {issueLines.length === 0 ? (
            <p className="text-sm text-content-secondary">
              No data-quality issues found for this period.
            </p>
          ) : (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {issueLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <ReportExportButtons
            reportId="provincial_data_quality"
            table={dataQualityTable}
            filters={filters}
            record={recordExport('provincial_data_quality')}
            meta={{
              title: 'Provincial data quality',
              description: 'One row per school and data-quality issue.',
              scope: scopeLabel,
              generatedAt,
              generatedBy: user?.email ?? 'Funda360 user',
            }}
          />
        </div>
        {report.data_quality.unlinked_schools !== null &&
          report.data_quality.unlinked_schools > 0 && (
            <p className="text-sm text-content-secondary">
              {count(report.data_quality.unlinked_schools)} schools on the platform are not linked
              to any education area and cannot appear under a province until they are linked under
              Education Areas.
            </p>
          )}
        {report.data_quality.schools.length > 0 && (
          <details className="rounded-md border border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium text-content-primary">
              Schools with issues
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {report.data_quality.schools.map((s) => (
                <li key={s.id}>
                  <Link to={`/district/schools/${s.id}`} className="font-medium text-brand-600">
                    {s.name}
                  </Link>
                  <p className="text-xs text-content-tertiary">
                    {[s.district, s.circuit].filter(Boolean).join(' / ')}
                  </p>
                  <p className="text-content-secondary">
                    {describeDataQuality(s.issues).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card title={`Schools (${report.schools.length})`}>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {report.schools.map((s) => (
            <li key={s.id} className="min-w-0">
              <Link to={`/district/schools/${s.id}`} className="break-words text-brand-600">
                {s.name}
              </Link>
              <span className="text-xs text-content-tertiary">
                {' '}
                · {[s.district, s.circuit].filter(Boolean).join(' / ')}
              </span>
            </li>
          ))}
        </ul>
        {report.schools.length === 0 && (
          <p className="text-sm text-content-secondary">No schools match these filters.</p>
        )}
      </Card>

      <details className="rounded-card border border-border bg-surface-raised p-4 text-sm text-content-secondary">
        <summary className="cursor-pointer font-medium text-content-primary">
          How these figures are calculated
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            Every figure is the same calculation as the District Dashboard and Government Reports,
            over the schools linked to this province.
          </li>
          <li>
            District attendance and average marks are pooled over all records in the district, not
            averages of school averages.
          </li>
          <li>
            A district requires attention when one of its schools requires attention, its attendance
            is below {thresholds.attendance}%, its average mark is below {thresholds.performance}%,
            or an intervention is overdue. These thresholds are Funda360 defaults, not official
            targets.
          </li>
          <li>
            Intervention workload = open + in-progress interventions. Trends need at least two
            periods; otherwise “No sufficient data” is shown.
          </li>
          <li>
            Subject filtering is not supported; the subject breakdown is on the Government Reports
            page.
          </li>
          <li>Generated {generatedAt}. This is not an official government return.</li>
        </ul>
      </details>
    </>
  );
}
