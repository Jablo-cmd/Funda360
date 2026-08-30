import { parseCsv } from '@/lib/csv';
import { learnerSchema } from '@/features/learners/schemas/learnerSchema';
import type { CreateLearnerInput } from '@/features/learners/types/learner.types';

/**
 * The exact header row a template/upload must use — machine-readable
 * (matches the create-learner form's own field names) rather than
 * human-prose headers, so there is exactly one column-name convention to
 * document, and it's the same one `LearnerFormModal` already validates
 * against via `learnerSchema` (reused here, not re-implemented).
 */
export const LEARNER_IMPORT_HEADERS = [
  'learnerNumber',
  'admissionNumber',
  'firstName',
  'lastName',
  'dateOfBirth',
  'admissionDate',
  'gender',
  'homeLanguage',
] as const;

export type LearnerImportHeader = (typeof LEARNER_IMPORT_HEADERS)[number];

export interface LearnerImportRowResult {
  /** 1-based, counting only data rows (the header row is never row 1). */
  rowNumber: number;
  raw: Record<string, string>;
  input: CreateLearnerInput | null;
  errors: string[];
}

export interface LearnerImportSummary {
  results: LearnerImportRowResult[];
  validRows: CreateLearnerInput[];
  invalidCount: number;
}

/**
 * Parses and validates a learner-import CSV against the school's existing
 * learner_number/admission_number values (duplicate detection against the
 * database) AND against every other row already seen in this same file
 * (duplicate detection within the upload itself — two new admissions
 * sharing a typo'd number is exactly the kind of mistake bulk entry makes
 * likely). Reuses learnerSchema — the same validation a single manual
 * "Add learner" submission already goes through — rather than duplicating
 * field-format rules for the bulk path.
 */
export function parseLearnerImportCsv(
  csvText: string,
  existingLearnerNumbers: ReadonlySet<string>,
  existingAdmissionNumbers: ReadonlySet<string>,
): LearnerImportSummary {
  const table = parseCsv(csvText).filter((row) => row.some((cell) => cell.trim().length > 0));
  const results: LearnerImportRowResult[] = [];
  const validRows: CreateLearnerInput[] = [];

  if (table.length === 0) {
    return { results, validRows, invalidCount: 0 };
  }

  const headerRow = (table[0] ?? []).map((cell) => cell.trim());
  const missingHeaders = LEARNER_IMPORT_HEADERS.filter(
    (required) => !['gender', 'homeLanguage'].includes(required) && !headerRow.includes(required),
  );
  if (missingHeaders.length > 0) {
    return {
      results: [
        {
          rowNumber: 0,
          raw: {},
          input: null,
          errors: [`Missing required column(s): ${missingHeaders.join(', ')}. Expected headers: ${LEARNER_IMPORT_HEADERS.join(', ')}.`],
        },
      ],
      validRows: [],
      invalidCount: 1,
    };
  }

  const seenLearnerNumbers = new Set<string>();
  const seenAdmissionNumbers = new Set<string>();

  const dataRows = table.slice(1);
  dataRows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const raw: Record<string, string> = {};
    headerRow.forEach((header, i) => {
      raw[header] = (cells[i] ?? '').trim();
    });

    const candidate = {
      learnerNumber: raw.learnerNumber ?? '',
      admissionNumber: raw.admissionNumber ?? '',
      firstName: raw.firstName ?? '',
      lastName: raw.lastName ?? '',
      dateOfBirth: raw.dateOfBirth ?? '',
      admissionDate: raw.admissionDate ?? '',
      gender: raw.gender || undefined,
      homeLanguage: raw.homeLanguage || undefined,
    };

    const parsed = learnerSchema.safeParse(candidate);
    const errors: string[] = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);

    if (candidate.learnerNumber) {
      if (existingLearnerNumbers.has(candidate.learnerNumber)) errors.push(`Learner number "${candidate.learnerNumber}" already exists at this school.`);
      else if (seenLearnerNumbers.has(candidate.learnerNumber)) errors.push(`Learner number "${candidate.learnerNumber}" is duplicated elsewhere in this file.`);
    }
    if (candidate.admissionNumber) {
      if (existingAdmissionNumbers.has(candidate.admissionNumber)) errors.push(`Admission number "${candidate.admissionNumber}" already exists at this school.`);
      else if (seenAdmissionNumbers.has(candidate.admissionNumber)) errors.push(`Admission number "${candidate.admissionNumber}" is duplicated elsewhere in this file.`);
    }

    const input: CreateLearnerInput | null = errors.length === 0 ? candidate : null;
    if (input) {
      validRows.push(input);
      seenLearnerNumbers.add(input.learnerNumber);
      seenAdmissionNumbers.add(input.admissionNumber);
    }

    results.push({ rowNumber, raw, input, errors });
  });

  return { results, validRows, invalidCount: results.filter((r) => r.errors.length > 0).length };
}
