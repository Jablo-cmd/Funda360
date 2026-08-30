import type { LearnerDocument } from '@/features/learners/types/learner.types';

export const DOCUMENT_TYPE_LABELS: Record<LearnerDocument['documentType'], string> = {
  birth_certificate: 'Birth certificate',
  id_copy: 'ID copy',
  passport: 'Passport',
  permit: 'Permit',
  transfer_letter: 'Transfer letter',
  medical_certificate: 'Medical certificate',
  report_card: 'Report card',
  other: 'Other',
};
