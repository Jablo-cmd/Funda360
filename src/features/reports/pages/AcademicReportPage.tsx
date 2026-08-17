import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademicReport } from '@/features/reports/hooks/useAcademicReport';
import { SummaryCard } from '@/features/reports/components/SummaryCard';
import { SummaryBar } from '@/features/reports/components/SummaryBar';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import type { AcademicReportSummary } from '@/features/reports/types/report.types';

interface EntityRow {
  entity: string;
  active: number;
  archived: number;
  total: number;
}

function toEntityRows(data: AcademicReportSummary): EntityRow[] {
  return [
    { entity: 'Grades', ...data.grades },
    { entity: 'Classes', ...data.classes },
    { entity: 'Subjects', ...data.subjects },
    { entity: 'Terms', ...data.terms },
  ];
}

export function AcademicReportPage() {
  const { can } = usePermissions();
  const canView = can('academic.view');
  const { school } = useSchool();
  const { data, isLoading, error } = useAcademicReport(canView ? school?.id : undefined);

  if (!canView) {
    return (
      <PageContainer>
        <ErrorAlert message="You don't have permission to view this report." />
      </PageContainer>
    );
  }

  const entityRows = data ? toEntityRows(data) : [];
  const hasData = entityRows.some((row) => row.total > 0);

  return (
    <PageContainer>
      <PageHeader
        title="Academic report"
        description="Active vs. archived counts for years, grades, classes, subjects and terms."
        action={
          data && (
            <ExportCsvButton
              rows={entityRows}
              columns={[
                { key: 'entity', header: 'Entity' },
                { key: 'active', header: 'Active' },
                { key: 'archived', header: 'Archived' },
                { key: 'total', header: 'Total' },
              ]}
              filename="academic-report.csv"
            />
          )
        }
      />

      <ErrorAlert message={error} />

      {isLoading ? (
        <LoadingBlock label="Loading academic report…" />
      ) : data && hasData ? (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Current academic year" value={data.currentAcademicYear?.name ?? 'None active'} />
          </dl>

          <section className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
            <h2 className="text-base font-semibold text-content-primary">Active vs. archived</h2>
            {entityRows.map((row) => (
              <SummaryBar key={row.entity} label={row.entity} count={row.active} total={row.total} />
            ))}
          </section>
        </>
      ) : (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No data yet for this school.
        </div>
      )}
    </PageContainer>
  );
}
