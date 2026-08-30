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

/**
 * RFC 4180-style parser — the inverse of toCsv above (same quoting rules:
 * a cell is quoted only when it needs to be, "" inside a quoted cell is an
 * escaped literal quote). Handles both \r\n and bare \n line endings.
 * Returns every row as an array of raw string cells, header row included —
 * callers decide how to map columns, matching toCsv's own "caller supplies
 * the column list" shape rather than assuming object keys from headers.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      endCell();
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      endRow();
      i += 1;
      continue;
    }
    cell += char;
    i += 1;
  }

  // A trailing newline should not produce a phantom empty final row, but a
  // file with no trailing newline must still flush its last cell/row.
  if (cell.length > 0 || row.length > 0) {
    endRow();
  }

  return rows;
}
