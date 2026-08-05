/**
 * Generic CSV serializer — lives here, not inside a feature, because it's
 * a reusable utility any future module could need, not report-specific
 * business logic. No external dependency: RFC 4180-style quoting only
 * (wrap in double quotes and escape embedded quotes whenever a cell
 * contains a comma, a quote, or a newline), nothing more.
 */

export interface CsvColumn<T> {
  key: keyof T;
  header: string;
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/["\n,]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Deterministic: column order always matches `columns`, never object-key iteration order. */
export function toCsv<T extends object>(rows: T[], columns: readonly CsvColumn<T>[]): string {
  const headerRow = columns.map((column) => escapeCsvCell(column.header)).join(',');
  const dataRows = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(','));
  return [headerRow, ...dataRows].join('\r\n');
}
