import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademicReport } from '@/features/reports/hooks/useAcademicReport';
import { SummaryCard } from '@/features/reports/components/SummaryCard';
import { SummaryBar } from '@/features/reports/components/SummaryBar';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';
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

  const entityRows = data ? toEntityRows(data) : [];
  const hasData = entityRows.some((row) => row.total > 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Academic report</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Active vs. archived counts for years, grades, classes, subjects and terms.
          </p>
        </div>
        {data && (
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
        )}
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
          <span className="sr-only">Loading academic report…</span>
        </div>
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
    </div>
  );
}
