import type { BankStatementLineStatus } from '@/lib/database.types';

export type { BankStatementLineStatus };

export interface BankReconciliationImport {
  id: string;
  schoolId: string;
  fileName: string;
  importedAt: string;
}

export interface BankStatementLine {
  id: string;
  schoolId: string;
  importId: string;
  transactionDate: string;
  description: string;
  amount: number;
  status: BankStatementLineStatus;
  matchedPaymentId: string | null;
  matchedAt: string | null;
}

export interface NewBankStatementLine {
  transactionDate: string;
  description: string;
  amount: number;
}
