import type { FeeCategory, FeePaymentMethod } from '@/lib/database.types';

export type { FeeCategory, FeePaymentMethod };

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

export interface LearnerFeeCharge {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  feeStructureId: string | null;
  description: string;
  category: FeeCategory;
  amount: number;
  dueDate: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerFeePayment {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  amount: number;
  paymentDate: string;
  method: FeePaymentMethod;
  reference: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeChargeInput {
  academicYearId: string;
  description: string;
  category: FeeCategory;
  amount: number;
  dueDate?: string | null;
  notes?: string | null;
}

export interface CreateFeePaymentInput {
  academicYearId: string;
  amount: number;
  paymentDate: string;
  method: FeePaymentMethod;
  reference?: string | null;
  notes?: string | null;
}

export type FeeStatus = 'paid' | 'partially_paid' | 'outstanding' | 'overdue';

export interface LearnerFeeSummary {
  totalCharged: number;
  totalPaid: number;
  outstandingBalance: number;
  status: FeeStatus;
  lastPayment: LearnerFeePayment | null;
  charges: LearnerFeeCharge[];
  payments: LearnerFeePayment[];
}
