import { useId, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { DataTable } from '@/components/ui/DataTable';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useAuth } from '@/features/auth/context/authContext';
import { ReportFiltersBar } from '@/features/government/components/ReportFiltersBar';
import { ReportExportButtons } from '@/features/government/components/ReportExportButtons';
import { useGovernmentReport, useReportingScope } from '@/features/government/hooks/useGovernmentReports';
import { useReportFilters } from '@/features/government/hooks/useReportFilters';
import { describeFilters } from '@/features/government/utils/reportFilters';
import {
  REPORT_DEFINITIONS,
  findReportDefinition,
  formatPercent,
  type CellValue,
} from '@/features/government/utils/reportDefinitions';
import { EXPORT_DISCLAIMER } from '@/features/government/utils/reportExport';

function renderCell(value: CellValue, header: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && header.includes('%')) return formatPercent(value);
  if (typeof value === 'number') return value.toLocaleString('en-ZA');
  return value;
}

/**
 * Government-style reports for the caller's scope. The layouts are
 * Funda360's own; no official return format is implied.
 */
export function GovernmentReportsPage() {
  const id = useId();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useReportFilters();
  const { user } = useAuth();
  const scope = useReportingScope();
  const report = useGovernmentReport(filters, scope.data !== null);
  const definition = findReportDefinition(params.get('report'));

  const lookups = useMemo(
    () => ({
      areaName: (areaId: string) => scope.data?.areas.find((a) => a.id === areaId)?.name,
      schoolName: (schoolId: string) => scope.data?.schools.find((s) => s.id === schoolId)?.name,
    }),
    [scope.data],
  );

  const table = useMemo(() => (report.data ? definition.build(report.data) : null), [report.data, definition]);
  const keyedRows = useMemo(() => (table?.rows ?? []).map((row, index) => ({ ...row, __row: index })), [table]);
  const scopeLabel = describeFilters(filters, lookups);

  const columns: DataTableColumn<Record<string, CellValue>>[] = (table?.columns ?? []).map((column) => ({
    key: column.key,
    header: column.header,
    align: column.numeric ? 'right' : 'left',
    render: (row) => renderCell(row[column.key] ?? null, column.header),
  }));

  const selectReport = (reportId: string) => {
    const next = new URLSearchParams(params);
    next.set('report', reportId);
    setParams(next, { replace: true });
  };

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
        <PageHeader title="Government reports" />
        <ErrorAlert message={scope.error ?? 'You do not have reporting access.'} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Government reports" description="Structured reports for the schools in your reporting scope." />

      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-raised p-4">
        <label htmlFor={`${id}-report`} className="text-xs font-medium text-content-tertiary">
          Report
        </label>
        <select
          id={`${id}-report`}
          className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary lg:h-10 lg:max-w-md"
          value={definition.id}
          onChange={(e) => selectReport(e.target.value)}
        >
          {REPORT_DEFINITIONS.map((def) => (
            <option key={def.id} value={def.id}>
              {def.title}
            </option>
          ))}
        </select>
        <p className="text-sm text-content-secondary">{definition.description}</p>
      </div>

      <ReportFiltersBar scope={scope.data} filters={filters} onChange={setFilters} />
      <ErrorAlert message={report.error} />

      <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-lg font-semibold text-content-primary">
              {definition.title}
            </h2>
            <p className="break-words text-sm text-content-secondary">{scopeLabel}</p>
            {report.data && (
              <p className="text-xs text-content-tertiary">
                Generated {new Date(report.data.generated_at).toLocaleString('en-ZA')} from Funda360 records.
              </p>
            )}
          </div>
          {table && report.data && (
            <ReportExportButtons
              reportId={definition.id}
              table={table}
              filters={filters}
              meta={{
                title: definition.title,
                description: definition.description,
                scope: scopeLabel,
                generatedAt: new Date(report.data.generated_at).toLocaleString('en-ZA'),
                generatedBy: user?.email ?? 'Funda360 user',
              }}
            />
          )}
        </div>
        <DataTable
          columns={columns}
          rows={keyedRows}
          getRowKey={(row) => String(row.__row)}
          isLoading={report.isLoading}
          loadingLabel="Calculating report…"
          emptyMessage="No data for these filters."
        />
        <p className="text-xs text-content-tertiary">{EXPORT_DISCLAIMER}</p>
      </section>
    </PageContainer>
  );
}
