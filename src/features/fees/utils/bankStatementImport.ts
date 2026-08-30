import { parseCsv } from '@/lib/csv';

/**
 * Deliberately minimal — a bank statement export's own column set varies
 * wildly by bank, but every one of them can be reduced to these three
 * fields for matching purposes. amount is expected to already be
 * incoming-only (credits) — this feature reconciles against EXISTING
 * recorded fee payments, not a full debit/credit ledger; a finance user
 * filters their statement export to deposits before uploading, the same
 * way they would for any manual reconciliation process.
 */
export const BANK_STATEMENT_IMPORT_HEADERS = ['date', 'description', 'amount'] as const;

export interface BankStatementLineCandidate {
  /** 1-based, counting only data rows. */
  rowNumber: number;
  raw: Record<string, string>;
  transactionDate: string | null;
  description: string | null;
  amount: number | null;
  errors: string[];
}

export interface BankStatementImportSummary {
  results: BankStatementLineCandidate[];
  validRows: { transactionDate: string; description: string; amount: number }[];
  invalidCount: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseBankStatementCsv(csvText: string): BankStatementImportSummary {
  const table = parseCsv(csvText).filter((row) => row.some((cell) => cell.trim().length > 0));
  const results: BankStatementLineCandidate[] = [];
  const validRows: BankStatementImportSummary['validRows'] = [];

  if (table.length === 0) {
    return { results, validRows, invalidCount: 0 };
  }

  const headerRow = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const missingHeaders = BANK_STATEMENT_IMPORT_HEADERS.filter((required) => !headerRow.includes(required));
  if (missingHeaders.length > 0) {
    return {
      results: [
        {
          rowNumber: 0,
          raw: {},
          transactionDate: null,
          description: null,
          amount: null,
          errors: [`Missing required column(s): ${missingHeaders.join(', ')}. Expected headers: ${BANK_STATEMENT_IMPORT_HEADERS.join(', ')}.`],
        },
      ],
      validRows: [],
      invalidCount: 1,
    };
  }

  const dataRows = table.slice(1);
  dataRows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const raw: Record<string, string> = {};
    headerRow.forEach((header, i) => {
      raw[header] = (cells[i] ?? '').trim();
    });

    const errors: string[] = [];

    const dateValue = raw.date ?? '';
    const transactionDate = DATE_PATTERN.test(dateValue) ? dateValue : null;
    if (!transactionDate) errors.push('date must be in YYYY-MM-DD format.');

    const description = raw.description?.trim() || null;
    if (!description) errors.push('description is required.');

    const amountValue = Number(raw.amount);
    const amount = raw.amount && Number.isFinite(amountValue) && amountValue > 0 ? amountValue : null;
    if (amount === null) errors.push('amount must be a positive number.');

    if (errors.length === 0 && transactionDate && description && amount !== null) {
      validRows.push({ transactionDate, description, amount });
    }

    results.push({ rowNumber, raw, transactionDate, description, amount, errors });
  });

  return { results, validRows, invalidCount: results.filter((r) => r.errors.length > 0).length };
}
