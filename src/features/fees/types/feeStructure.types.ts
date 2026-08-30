import type { FeeCategory } from '@/lib/database.types';

export interface FeeStructure {
  id: string;
  schoolId: string;
  academicYearId: string;
  gradeId: string | null;
  name: string;
  category: FeeCategory;
  amount: number;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeStructureInput {
  academicYearId: string;
  gradeId?: string | null;
  name: string;
  category: FeeCategory;
  amount: number;
  description?: string | null;
}
