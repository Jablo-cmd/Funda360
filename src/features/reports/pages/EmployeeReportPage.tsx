import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useEmployeeReport } from '@/features/reports/hooks/useEmployeeReport';
import { SummaryCard } from '@/features/reports/components/SummaryCard';
import { SummaryBar } from '@/features/reports/components/SummaryBar';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';

export function EmployeeReportPage() {
  const { can } = usePermissions();
  const canView = can('employee.view');
  const { school } = useSchool();
  const { data, isLoading, error } = useEmployeeReport(canView ? school?.id : undefined);

  if (!canView) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          You don&apos;t have permission to view this report.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary">Employee report</h1>
        <p className="mt-1 text-sm text-content-secondary">Staff counts by department and employment status.</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading employee report…</span>
        </div>
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
    </div>
  );
}
