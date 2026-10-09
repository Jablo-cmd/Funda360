import { toCsv } from '@/lib/csv';
import type { CsvColumn } from '@/lib/csv';
import type { CellValue, ReportTable } from '@/features/government/utils/reportDefinitions';

/**
 * Report exports, built in the browser from data the caller was already
 * allowed to read. Every export is also recorded server-side
 * (record_government_report_export) before the file is produced.
 */

export interface ReportDocumentMeta {
  title: string;
  description: string;
  scope: string;
  generatedAt: string;
  generatedBy: string;
}

const UTF8_BOM = String.fromCharCode(0xfeff);

export const EXPORT_DISCLAIMER =
  'Funda360 report generated from school records in Funda360. This is not an official government return format.';

/** RFC 4180 CSV with the same formula-injection guard every other Funda360 export uses. */
export function reportToCsv(table: ReportTable): string {
  const columns: CsvColumn<Record<string, CellValue>>[] = table.columns.map((column) => ({
    key: column.key,
    header: column.header,
  }));
  return toCsv(table.rows, columns);
}

/**
 * Excel-compatible CSV: a UTF-8 byte-order mark so Excel opens accented
 * school and learner names correctly, CRLF line endings, and the report
 * header lines above the table.
 */
export function reportToExcelCsv(table: ReportTable, meta: ReportDocumentMeta): string {
  const header = [meta.title, meta.scope, `Generated ${meta.generatedAt} by ${meta.generatedBy}`, EXPORT_DISCLAIMER]
    .map((line) => toCsv([{ line }], [{ key: 'line', header: '' }]).split('\r\n')[1])
    .join('\r\n');
  return `${UTF8_BOM}${header}\r\n\r\n${reportToCsv(table)}`;
}

/** A file-system-safe name such as "funda360-attendance-2026-10-08". */
export function exportFilename(reportId: string, extension: string, today = new Date()): string {
  return `funda360-${reportId.replace(/_/g, '-')}-${today.toISOString().slice(0, 10)}.${extension}`;
}

function formatCell(value: CellValue): string {
  if (value === null || value === undefined) return '—';
  return typeof value === 'number' ? String(value) : value;
}

/** A4 landscape PDF: title band, scope and provenance lines, then the table. */
export async function reportToPdf(table: ReportTable, meta: ReportDocumentMeta): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 36;

  doc.setFillColor(18, 52, 91);
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(meta.title, marginX, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(meta.scope, marginX, 50, { maxWidth: pageWidth - marginX * 2 });

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text(meta.description, marginX, 84, { maxWidth: pageWidth - marginX * 2 });
  doc.text(`Generated ${meta.generatedAt} by ${meta.generatedBy}`, marginX, 100);

  autoTable(doc, {
    startY: 112,
    margin: { left: marginX, right: marginX },
    head: [table.columns.map((column) => column.header)],
    body: table.rows.map((row) => table.columns.map((column) => formatCell(row[column.key] ?? null))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [18, 52, 91] },
    columnStyles: Object.fromEntries(
      table.columns.map((column, index) => [index, { halign: column.numeric ? 'right' : 'left' }]),
    ),
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(EXPORT_DISCLAIMER, marginX, pageHeight - 18);
    doc.text(`Page ${page} of ${pages}`, pageWidth - marginX, pageHeight - 18, { align: 'right' });
  }

  return doc.output('blob');
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
