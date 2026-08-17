import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useEmployeeReport } from '@/features/reports/hooks/useEmployeeReport';
import { SummaryCard } from '@/features/reports/components/SummaryCard';
import { SummaryBar } from '@/features/reports/components/SummaryBar';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';

export function EmployeeReportPage() {
  const { can } = usePermissions();
  const canView = can('employee.view');
  const { school } = useSchool();
  const { data, isLoading, error } = useEmployeeReport(canView ? school?.id : undefined);

  if (!canView) {
    return (
      <PageContainer>
        <ErrorAlert message="You don't have permission to view this report." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Employee report" description="Staff counts by department and employment status." />

      <ErrorAlert message={error} />

      {isLoading ? (
        <LoadingBlock label="Loading employee report…" />
      ) : data && data.totalEmployees > 0 ? (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Total employees" value={data.totalEmployees} />
          </dl>

          <section className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-content-primary">By department</h2>
              <ExportCsvButton
                rows={data.byDepartment}
                columns={[
                  { key: 'departmentName', header: 'Department' },
                  { key: 'count', header: 'Count' },
                ]}
                filename="employee-report-by-department.csv"
                label="Export CSV"
              />
            </div>
            {data.byDepartment.map((entry) => (
              <SummaryBar
                key={entry.departmentId ?? 'unassigned'}
                label={entry.departmentName}
                count={entry.count}
                total={data.totalEmployees}
              />
            ))}
          </section>

          <section className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-content-primary">By employment status</h2>
              <ExportCsvButton
                rows={data.byStatus}
                columns={[
                  { key: 'status', header: 'Status' },
                  { key: 'count', header: 'Count' },
                ]}
                filename="employee-report-by-status.csv"
                label="Export CSV"
              />
            </div>
            {data.byStatus.map((entry) => (
              <SummaryBar key={entry.status} label={entry.status} count={entry.count} total={data.totalEmployees} />
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
