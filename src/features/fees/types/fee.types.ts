import type { FeeCategory, FeePaymentMethod, FeeAdjustmentType, FeeAdjustmentMethod, FeeRefundStatus } from '@/lib/database.types';

export type { FeeCategory, FeePaymentMethod, FeeAdjustmentType, FeeAdjustmentMethod, FeeRefundStatus };

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
  /** Set only via reconcile_bank_statement_line() — see FND-PAY-002. Null means not yet matched against any bank statement line. */
  reconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerFeeAdjustment {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  chargeId: string | null;
  adjustmentType: FeeAdjustmentType;
  method: FeeAdjustmentMethod;
  percentage: number | null;
  amount: number;
  reason: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerFeeRefund {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  paymentId: string;
  amount: number;
  refundDate: string;
  method: FeePaymentMethod;
  reference: string | null;
  reason: string;
  status: FeeRefundStatus;
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
  feeStructureId?: string | null;
}

export interface CreateFeePaymentInput {
  academicYearId: string;
  amount: number;
  paymentDate: string;
  method: FeePaymentMethod;
  reference?: string | null;
  notes?: string | null;
}

export interface CreateFeeAdjustmentInput {
  academicYearId: string;
  chargeId?: string | null;
  adjustmentType: FeeAdjustmentType;
  method: FeeAdjustmentMethod;
  percentage?: number | null;
  amount: number;
  reason: string;
}

export interface CreateFeeRefundInput {
  academicYearId: string;
  paymentId: string;
  amount: number;
  refundDate: string;
  method: FeePaymentMethod;
  reference?: string | null;
  reason: string;
  status?: FeeRefundStatus;
}

export type FeeStatus = 'paid' | 'partially_paid' | 'outstanding' | 'overdue';

export interface LearnerFeeSummary {
  totalCharged: number;
  totalAdjustments: number;
  totalPaid: number;
  totalRefunded: number;
  netPaid: number;
  outstandingBalance: number;
  status: FeeStatus;
  lastPayment: LearnerFeePayment | null;
  charges: LearnerFeeCharge[];
  payments: LearnerFeePayment[];
  adjustments: LearnerFeeAdjustment[];
  refunds: LearnerFeeRefund[];
}
