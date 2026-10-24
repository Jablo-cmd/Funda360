import { parseCsv } from '@/lib/csv';
import { learnerSchema } from '@/features/learners/schemas/learnerSchema';
import type { CreateLearnerInput } from '@/features/learners/types/learner.types';
import type { GuardianRelationshipType } from '@/lib/database.types';

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

/**
 * Optional guardian columns. A row that fills any of them must give the
 * guardian's first name, last name and email; one guardian (matched by
 * email) can appear on several rows, for siblings.
 */
export const GUARDIAN_IMPORT_HEADERS = [
  'guardianFirstName',
  'guardianLastName',
  'guardianEmail',
  'guardianPhone',
  'guardianRelationship',
] as const;

const GUARDIAN_RELATIONSHIPS: readonly GuardianRelationshipType[] = [
  'mother',
  'father',
  'legal_guardian',
  'grandparent',
  'sibling',
  'other',
];

export interface ImportedGuardian {
  firstName: string;
  lastName: string;
  /** Lower-cased; guardians are matched on it. */
  email: string;
  phone: string | null;
  relationshipType: GuardianRelationshipType;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseGuardian(raw: Record<string, string>): {
  guardian: ImportedGuardian | null;
  errors: string[];
} {
  const firstName = raw.guardianFirstName ?? '';
  const lastName = raw.guardianLastName ?? '';
  const email = (raw.guardianEmail ?? '').toLowerCase();
  const phone = raw.guardianPhone ?? '';
  const relationship = (raw.guardianRelationship ?? '').toLowerCase().replace(/\s+/g, '_');
  if (!firstName && !lastName && !email && !phone && !relationship)
    return { guardian: null, errors: [] };

  const errors: string[] = [];
  if (!firstName) errors.push('Guardian first name is required when a guardian is given.');
  if (!lastName) errors.push('Guardian last name is required when a guardian is given.');
  if (!EMAIL_PATTERN.test(email)) errors.push('Guardian email must be a valid email address.');
  if (relationship && !GUARDIAN_RELATIONSHIPS.includes(relationship as GuardianRelationshipType)) {
    errors.push(`Guardian relationship must be one of: ${GUARDIAN_RELATIONSHIPS.join(', ')}.`);
  }
  if (errors.length > 0) return { guardian: null, errors };
  return {
    guardian: {
      firstName,
      lastName,
      email,
      phone: phone || null,
      relationshipType: (relationship || 'legal_guardian') as GuardianRelationshipType,
    },
    errors,
  };
}

export interface LearnerImportRowResult {
  /** 1-based, counting only data rows (the header row is never row 1). */
  rowNumber: number;
  raw: Record<string, string>;
  input: CreateLearnerInput | null;
  /** The row's guardian, if it named one (and the row is valid). */
  guardian: ImportedGuardian | null;
  errors: string[];
}

export interface LearnerImportSummary {
  results: LearnerImportRowResult[];
  validRows: CreateLearnerInput[];
  /** Same order as validRows: the guardian named on that row, or null. */
  validGuardians: Array<ImportedGuardian | null>;
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
  const validGuardians: Array<ImportedGuardian | null> = [];

  if (table.length === 0) {
    return { results, validRows, validGuardians, invalidCount: 0 };
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
          guardian: null,
          errors: [
            `Missing required column(s): ${missingHeaders.join(', ')}. Expected headers: ${LEARNER_IMPORT_HEADERS.join(', ')}.`,
          ],
        },
      ],
      validRows: [],
      validGuardians: [],
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
    const errors: string[] = parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.message);

    if (candidate.learnerNumber) {
      if (existingLearnerNumbers.has(candidate.learnerNumber))
        errors.push(`Learner number "${candidate.learnerNumber}" already exists at this school.`);
      else if (seenLearnerNumbers.has(candidate.learnerNumber))
        errors.push(
          `Learner number "${candidate.learnerNumber}" is duplicated elsewhere in this file.`,
        );
    }
    if (candidate.admissionNumber) {
      if (existingAdmissionNumbers.has(candidate.admissionNumber))
        errors.push(
          `Admission number "${candidate.admissionNumber}" already exists at this school.`,
        );
      else if (seenAdmissionNumbers.has(candidate.admissionNumber))
        errors.push(
          `Admission number "${candidate.admissionNumber}" is duplicated elsewhere in this file.`,
        );
    }

    const guardianResult = parseGuardian(raw);
    errors.push(...guardianResult.errors);

    const input: CreateLearnerInput | null = errors.length === 0 ? candidate : null;
    const guardian = input ? guardianResult.guardian : null;
    if (input) {
      validRows.push(input);
      validGuardians.push(guardian);
      seenLearnerNumbers.add(input.learnerNumber);
      seenAdmissionNumbers.add(input.admissionNumber);
    }

    results.push({ rowNumber, raw, input, guardian, errors });
  });

  return {
    results,
    validRows,
    validGuardians,
    invalidCount: results.filter((r) => r.errors.length > 0).length,
  };
}
