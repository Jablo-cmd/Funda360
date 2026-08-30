import type { AcademicInterventionStatus } from '@/lib/database.types';

export type { AcademicInterventionStatus };

export interface AcademicIntervention {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  subjectId: string | null;
  title: string;
  description: string | null;
  status: AcademicInterventionStatus;
  targetDate: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcademicInterventionInput {
  academicYearId: string;
  subjectId?: string | null;
  title: string;
  description?: string | null;
  targetDate?: string | null;
}

export interface UpdateInterventionStatusInput {
  status: AcademicInterventionStatus;
  resolutionNotes?: string | null;
}
