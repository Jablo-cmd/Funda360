import { describe, expect, it } from 'vitest';
import { parseLearnerImportCsv, LEARNER_IMPORT_HEADERS } from './csvImport';

const HEADER_ROW = LEARNER_IMPORT_HEADERS.join(',');

function validRow(overrides: Partial<Record<(typeof LEARNER_IMPORT_HEADERS)[number], string>> = {}): string {
  const defaults = {
    learnerNumber: 'LRN-0001',
    admissionNumber: 'ADM-0001',
    firstName: 'Naledi',
    lastName: 'Dube',
    dateOfBirth: '2013-05-01',
    admissionDate: '2026-01-15',
    gender: 'female',
    homeLanguage: 'English',
  };
  const merged = { ...defaults, ...overrides };
  return LEARNER_IMPORT_HEADERS.map((h) => merged[h]).join(',');
}

describe('parseLearnerImportCsv', () => {
  it('parses a valid row into a CreateLearnerInput', () => {
    const csv = `${HEADER_ROW}\n${validRow()}`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.invalidCount).toBe(0);
    expect(summary.validRows).toHaveLength(1);
    expect(summary.validRows[0]).toMatchObject({ learnerNumber: 'LRN-0001', firstName: 'Naledi', lastName: 'Dube' });
  });

  it('reports a missing-column error and stops, when the header row is missing a required column', () => {
    const csv = 'learnerNumber,firstName\nLRN-0001,Naledi';
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.validRows).toHaveLength(0);
    expect(summary.results[0]!.errors[0]).toMatch(/Missing required column/);
  });

  it('rejects a row missing a required field (reusing learnerSchema, not duplicating validation rules)', () => {
    const csv = `${HEADER_ROW}\n${validRow({ firstName: '' })}`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.validRows).toHaveLength(0);
    expect(summary.invalidCount).toBe(1);
    expect(summary.results[0]!.errors.some((e) => /first name/i.test(e))).toBe(true);
  });

  it('rejects a row whose date of birth is implausible (delegated to the same schema rule the manual form uses)', () => {
    const csv = `${HEADER_ROW}\n${validRow({ dateOfBirth: '1990-01-01' })}`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.validRows).toHaveLength(0);
  });

  it('flags a learner number that already exists at the school', () => {
    const csv = `${HEADER_ROW}\n${validRow()}`;
    const summary = parseLearnerImportCsv(csv, new Set(['LRN-0001']), new Set());
    expect(summary.validRows).toHaveLength(0);
    expect(summary.results[0]!.errors.some((e) => /already exists/.test(e))).toBe(true);
  });

  it('flags an admission number that already exists at the school', () => {
    const csv = `${HEADER_ROW}\n${validRow()}`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set(['ADM-0001']));
    expect(summary.validRows).toHaveLength(0);
  });

  it('flags two rows in the same file sharing a learner number, but keeps the first as valid', () => {
    const csv = `${HEADER_ROW}\n${validRow()}\n${validRow({ admissionNumber: 'ADM-0002' })}`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.validRows).toHaveLength(1);
    expect(summary.invalidCount).toBe(1);
    expect(summary.results[1]!.errors.some((e) => /duplicated elsewhere in this file/.test(e))).toBe(true);
  });

  it('processes multiple independent valid rows', () => {
    const csv = `${HEADER_ROW}\n${validRow()}\n${validRow({ learnerNumber: 'LRN-0002', admissionNumber: 'ADM-0002', firstName: 'Sipho' })}`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.validRows).toHaveLength(2);
    expect(summary.invalidCount).toBe(0);
  });

  it('skips blank lines rather than treating them as malformed rows', () => {
    const csv = `${HEADER_ROW}\n${validRow()}\n\n`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.results).toHaveLength(1);
    expect(summary.validRows).toHaveLength(1);
  });

  it('returns an empty summary for an empty file', () => {
    const summary = parseLearnerImportCsv('', new Set(), new Set());
    expect(summary.results).toHaveLength(0);
    expect(summary.validRows).toHaveLength(0);
    expect(summary.invalidCount).toBe(0);
  });

  it('a row with a duplicate rejected earlier does not poison a later distinct valid row', () => {
    const csv = `${HEADER_ROW}\n${validRow()}\n${validRow()}\n${validRow({ learnerNumber: 'LRN-0003', admissionNumber: 'ADM-0003' })}`;
    const summary = parseLearnerImportCsv(csv, new Set(), new Set());
    expect(summary.validRows).toHaveLength(2);
    expect(summary.invalidCount).toBe(1);
  });
});
