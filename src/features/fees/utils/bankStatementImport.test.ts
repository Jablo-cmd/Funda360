import { describe, expect, it } from 'vitest';
import { parseBankStatementCsv } from './bankStatementImport';

describe('parseBankStatementCsv', () => {
  it('parses a valid row', () => {
    const csv = 'date,description,amount\n2026-02-01,EFT REF 001,1500.00';
    const summary = parseBankStatementCsv(csv);
    expect(summary.invalidCount).toBe(0);
    expect(summary.validRows).toEqual([{ transactionDate: '2026-02-01', description: 'EFT REF 001', amount: 1500 }]);
  });

  it('is case-insensitive and order-independent on headers', () => {
    const csv = 'Amount,Date,Description\n1500.00,2026-02-01,EFT REF 001';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toEqual([{ transactionDate: '2026-02-01', description: 'EFT REF 001', amount: 1500 }]);
  });

  it('reports a missing-column error and stops, when the header row is missing a required column', () => {
    const csv = 'date,description\n2026-02-01,EFT REF 001';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toHaveLength(0);
    expect(summary.results[0]!.errors[0]).toMatch(/Missing required column/);
  });

  it('rejects a non-YYYY-MM-DD date', () => {
    const csv = 'date,description,amount\n01/02/2026,EFT REF 001,1500.00';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toHaveLength(0);
    expect(summary.results[0]!.errors).toContain('date must be in YYYY-MM-DD format.');
  });

  it('rejects a zero or negative amount', () => {
    const csv = 'date,description,amount\n2026-02-01,Refund,-50.00';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toHaveLength(0);
    expect(summary.results[0]!.errors).toContain('amount must be a positive number.');
  });

  it('rejects a non-numeric amount', () => {
    const csv = 'date,description,amount\n2026-02-01,Refund,abc';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toHaveLength(0);
  });

  it('rejects a missing description', () => {
    const csv = 'date,description,amount\n2026-02-01,,1500.00';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toHaveLength(0);
    expect(summary.results[0]!.errors).toContain('description is required.');
  });

  it('parses multiple rows, tracking each row number', () => {
    const csv = 'date,description,amount\n2026-02-01,Row one,1500.00\n2026-02-02,Row two,2200.00';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toHaveLength(2);
    expect(summary.results.map((r) => r.rowNumber)).toEqual([1, 2]);
  });

  it('returns an empty summary for an empty file', () => {
    const summary = parseBankStatementCsv('');
    expect(summary.results).toHaveLength(0);
    expect(summary.validRows).toHaveLength(0);
  });

  it('skips blank lines', () => {
    const csv = 'date,description,amount\n2026-02-01,Row one,1500.00\n\n2026-02-02,Row two,2200.00';
    const summary = parseBankStatementCsv(csv);
    expect(summary.validRows).toHaveLength(2);
  });
});
