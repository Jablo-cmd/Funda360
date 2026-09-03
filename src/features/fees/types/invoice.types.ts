import type { FeeCategory, InvoiceStatus } from '@/lib/database.types';

export type { InvoiceStatus };

export interface Invoice {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: FeeCategory;
  amount: number;
  dueDate: string | null;
}

/** Presentation status derived from the stored status + the payment allocations against the invoice. */
export type InvoicePresentationStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void';

export interface InvoiceWithDetail extends Invoice {
  lineItems: InvoiceLineItem[];
  amountAllocated: number;
  balance: number;
  presentationStatus: InvoicePresentationStatus;
  /** Populated only by the school-wide invoice register (listInvoicesForSchool). */
  learnerName?: string;
}

export interface CreateInvoiceInput {
  academicYearId: string;
  notes?: string | null;
  dueDate?: string | null;
  /** Charges to raise as line items when the invoice is created. */
  lines: {
    description: string;
    category: FeeCategory;
    amount: number;
    dueDate?: string | null;
    feeStructureId?: string | null;
  }[];
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
}

export interface FeeReceipt {
  id: string;
  schoolId: string;
  learnerId: string;
  paymentId: string;
  receiptNumber: string;
  issuedAt: string;
}

/** One movement on a learner or family account, oldest first — the statement line. */
export interface StatementEntry {
  date: string;
  type: 'charge' | 'payment' | 'adjustment' | 'refund';
  description: string;
  reference: string | null;
  /** Positive = increases what is owed (charge). Negative = reduces it (payment, adjustment, completed refund reverses a payment so it is positive again). */
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AccountStatement {
  openingBalance: number;
  closingBalance: number;
  entries: StatementEntry[];
  /** Debtor ageing of the closing balance. */
  ageing: { current: number; days30: number; days60: number; days90: number; days120Plus: number };
}
