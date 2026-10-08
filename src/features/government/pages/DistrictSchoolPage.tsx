import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { KpiTile } from '@/features/government/components/KpiTile';
import { toneForRate } from '@/features/government/utils/kpiTone';
import { AttentionPills } from '@/features/government/components/AttentionPills';
import { ReportFiltersBar } from '@/features/government/components/ReportFiltersBar';
import {
  useGovernmentReport,
  useReportingScope,
  useSchoolReport,
} from '@/features/government/hooks/useGovernmentReports';
import { useReportFilters } from '@/features/government/hooks/useReportFilters';
import { describeDataQuality, formatPercent } from '@/features/government/utils/reportDefinitions';
import type { SchoolReportClassRow } from '@/features/government/types/government.types';

/**
 * District -> School -> Grade -> Class. The school id comes from the URL,
 * but get_school_report() refuses any school outside the caller's scope,
 * so editing the URL only produces a permission message.
 */
export function DistrictSchoolPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [filters, setFilters, filterQuery] = useReportFilters();
  const scope = useReportingScope();
  const classes = useSchoolReport(schoolId, filters);
  const summaryFilters = useMemo(() => ({ ...filters, school_id: schoolId }), [filters, schoolId]);
  const summary = useGovernmentReport(summaryFilters, Boolean(schoolId));
  const school = summary.data?.schools[0];

  const grades = useMemo(() => {
    const groups = new Map<string, SchoolReportClassRow[]>();
    for (const row of classes.data?.classes ?? []) {
      groups.set(row.grade, [...(groups.get(row.grade) ?? []), row]);
    }
    return [...groups.entries()];
  }, [classes.data]);

  const error = classes.error ?? summary.error;
  const learnerDetail = classes.data?.learner_detail ?? false;

  const columns: DataTableColumn<SchoolReportClassRow>[] = [
    {
      key: 'class',
      header: 'Class',
      render: (c) =>
        learnerDetail ? (
          <Link to={`/district/schools/${schoolId}/classes/${c.id}${filterQuery}`} className="font-medium text-brand-600">
            {c.name}
          </Link>
        ) : (
          <span className="font-medium">{c.name}</span>
        ),
    },
    { key: 'learners', header: 'Learners', align: 'right', render: (c) => c.learners },
    { key: 'attendance', header: 'Attendance', align: 'right', render: (c) => (c.suppressed ? 'Withheld' : formatPercent(c.attendance_rate)) },
    { key: 'average', header: 'Average mark', align: 'right', render: (c) => (c.suppressed ? 'Withheld' : formatPercent(c.average_percent)) },
    { key: 'risk', header: 'Learners at risk', align: 'right', render: (c) => (c.suppressed ? 'Withheld' : String(c.learners_requiring_intervention ?? '—')) },
    { key: 'assessments', header: 'Assessments', align: 'right', render: (c) => c.assessments },
    {
      key: 'last',
      header: 'Last register',
      render: (c) =>
        c.last_attendance_date ?? <span className="text-danger-600">Never</span>,
    },
  ];

  return (
    <PageContainer>
      <Link to={`/district${filterQuery}`} className="text-sm text-content-tertiary">
        ← District dashboard
      </Link>
      <PageHeader
        title={school?.name ?? classes.data?.school.name ?? 'School'}
        description={
          school
            ? [school.district, school.circuit].filter(Boolean).join(' / ') +
              (school.emis_number ? ` · EMIS ${school.emis_number}` : '') +
              (school.academic_year ? ` · ${school.academic_year}` : '')
            : undefined
        }
      />
      {scope.data && <ReportFiltersBar scope={scope.data} filters={filters} onChange={setFilters} hideSchool />}
      <ErrorAlert message={error} />

      {(classes.isLoading || summary.isLoading) && !classes.data && <LoadingBlock label="Loading school figures…" />}

      {school && summary.data && (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="Learners enrolled" value={String(school.learners_enrolled)} hint={`${school.learners_active} on the register`} />
            <KpiTile
              label="Educators"
              value={String(school.educators)}
              hint={school.learner_educator_ratio !== null ? `${school.learner_educator_ratio} learners per educator` : undefined}
            />
            <KpiTile
              label="Attendance rate"
              value={formatPercent(school.attendance_rate)}
              tone={toneForRate(school.attendance_rate, summary.data.thresholds.attendance)}
            />
            <KpiTile
              label="Average mark"
              value={formatPercent(school.average_percent)}
              tone={toneForRate(school.average_percent, summary.data.thresholds.performance)}
              hint={school.pass_rate !== null ? `Pass rate ${formatPercent(school.pass_rate)}` : undefined}
            />
          </dl>
          <Card title="Status">
            <AttentionPills reasons={school.attention} />
            {describeDataQuality(school.data_quality).length > 0 && (
              <p className="text-sm text-content-secondary">{describeDataQuality(school.data_quality).join(' · ')}</p>
            )}
            <p className="text-sm text-content-secondary">
              Interventions: {school.interventions.open} open, {school.interventions.in_progress} in progress,{' '}
              {school.interventions.overdue} overdue, {school.interventions.resolved} resolved in the period.
            </p>
          </Card>
        </>
      )}

      {classes.data && (
        <>
          {!learnerDetail && (
            <p className="rounded-card border border-border bg-surface-raised px-4 py-3 text-sm text-content-secondary">
              You can see class figures for this school. Learner names are only shown to officials granted learner-level
              access.
            </p>
          )}
          {grades.length === 0 ? (
            <p className="rounded-card border border-border bg-surface-raised px-4 py-6 text-sm text-content-secondary">
              No active classes for these filters.
            </p>
          ) : (
            grades.map(([grade, rows]) => (
              <Card key={grade} title={grade}>
                <DataTable columns={columns} rows={rows} getRowKey={(c) => c.id} />
              </Card>
            ))
          )}
        </>
      )}
    </PageContainer>
  );
}
