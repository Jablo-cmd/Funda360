import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { downloadCsv } from '@/features/reports/utils/downloadCsv';
import { governmentReportService } from '@/features/government/services/governmentReportService';
import type { ExportFormat, GovernmentReportFilters } from '@/features/government/types/government.types';
import type { ReportTable } from '@/features/government/utils/reportDefinitions';
import {
  downloadBlob,
  exportFilename,
  reportToCsv,
  reportToExcelCsv,
  reportToPdf,
  type ReportDocumentMeta,
} from '@/features/government/utils/reportExport';

export interface ReportExportButtonsProps {
  reportId: string;
  table: ReportTable;
  meta: ReportDocumentMeta;
  filters: GovernmentReportFilters;
}

/**
 * CSV, Excel-compatible CSV and PDF. Hidden without `government.export`.
 * Each export is recorded in the audit log first; if that fails the file is
 * not produced.
 */
export function ReportExportButtons({ reportId, table, meta, filters }: ReportExportButtonsProps) {
  const { can } = usePermissions();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  if (!can('government.export')) return null;

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await governmentReportService.recordExport(reportId, format, filters);
      if (format === 'csv') {
        downloadCsv(exportFilename(reportId, 'csv'), reportToCsv(table));
      } else if (format === 'excel_csv') {
        downloadCsv(exportFilename(`${reportId}-excel`, 'csv'), reportToExcelCsv(table, meta));
      } else {
        downloadBlob(exportFilename(reportId, 'pdf'), await reportToPdf(table, meta));
      }
    } catch (err) {
      showToast(getDbErrorMessage(err, 'The export failed.'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const disabled = table.rows.length === 0 || busy !== null;
  return (
    <div className="grid w-full grid-cols-3 gap-2 lg:w-[24rem]">
      <Button type="button" variant="secondary" disabled={disabled} isLoading={busy === 'csv'} onClick={() => void run('csv')}>
        CSV
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        isLoading={busy === 'excel_csv'}
        onClick={() => void run('excel_csv')}
      >
        Excel (CSV)
      </Button>
      <Button type="button" variant="secondary" disabled={disabled} isLoading={busy === 'pdf'} onClick={() => void run('pdf')}>
        PDF
      </Button>
    </div>
  );
}
