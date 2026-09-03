import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/pagination';
import type {
  InvoiceRow,
  LearnerFeeChargeRow,
  LearnerFeePaymentAllocationRow,
  FeeReceiptRow,
} from '@/lib/database.types';
import { subtractMoney, sumMoney } from '@/lib/money';
import type {
  Invoice,
  InvoiceWithDetail,
  InvoiceLineItem,
  InvoicePresentationStatus,
  CreateInvoiceInput,
  FeeReceipt,
  PaymentAllocation,
  AccountStatement,
} from '@/features/fees/types/invoice.types';
import { feeService } from '@/features/fees/services/feeService';
import { buildAccountStatement } from '@/features/fees/utils/statement';

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    notes: row.notes,
    vatRate: row.vat_rate,
    subtotal: row.subtotal,
    vatAmount: row.vat_amount,
    total: row.total,
    issuedAt: row.issued_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLineItem(row: LearnerFeeChargeRow): InvoiceLineItem {
  return { id: row.id, description: row.description, category: row.category, amount: row.amount, dueDate: row.due_date };
}

function toAllocation(row: LearnerFeePaymentAllocationRow): PaymentAllocation {
  return { id: row.id, paymentId: row.payment_id, invoiceId: row.invoice_id, amount: row.amount };
}

function toReceipt(row: FeeReceiptRow): FeeReceipt {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    paymentId: row.payment_id,
    receiptNumber: row.receipt_number,
    issuedAt: row.issued_at,
  };
}

function derivePresentationStatus(invoice: Invoice, amountAllocated: number, today: string): InvoicePresentationStatus {
  if (invoice.status === 'void') return 'void';
  if (invoice.status === 'draft') return 'draft';
  const balance = subtractMoney(invoice.total, amountAllocated);
  if (balance <= 0 && invoice.total > 0) return 'paid';
  if (invoice.dueDate !== null && invoice.dueDate < today) return 'overdue';
  if (amountAllocated > 0) return 'partially_paid';
  return 'issued';
}

async function decorate(invoices: Invoice[]): Promise<InvoiceWithDetail[]> {
  if (invoices.length === 0) return [];
  const ids = invoices.map((i) => i.id);
  const [chargeRows, allocationRows] = await Promise.all([
    fetchAllRows<LearnerFeeChargeRow>((from, to) =>
      supabase.from('learner_fee_charges').select('*').in('invoice_id', ids).eq('active', true).range(from, to),
    ),
    fetchAllRows<LearnerFeePaymentAllocationRow>((from, to) =>
      supabase.from('learner_fee_payment_allocations').select('*').in('invoice_id', ids).range(from, to),
    ),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return invoices.map((invoice) => {
    const lineItems = chargeRows.filter((c) => c.invoice_id === invoice.id).map(toLineItem);
    const amountAllocated = sumMoney(
      allocationRows.filter((a) => a.invoice_id === invoice.id).map((a) => a.amount),
    );
    return {
      ...invoice,
      lineItems,
      amountAllocated,
      balance: Math.max(0, subtractMoney(invoice.total, amountAllocated)),
      presentationStatus: derivePresentationStatus(invoice, amountAllocated, today),
    };
  });
}

async function listInvoicesForLearner(learnerId: string): Promise<InvoiceWithDetail[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return decorate(data.map(toInvoice));
}

async function listInvoicesForSchool(schoolId: string, academicYearId: string): Promise<InvoiceWithDetail[]> {
  const rows = await fetchAllRows<InvoiceRow>((from, to) =>
    supabase
      .from('invoices')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .order('created_at', { ascending: false })
      .range(from, to),
  );
  const decorated = await decorate(rows.map(toInvoice));

  const learnerIds = [...new Set(decorated.map((i) => i.learnerId))];
  if (learnerIds.length === 0) return decorated;
  const nameRows = await fetchAllRows<{ id: string; first_name: string; last_name: string }>((from, to) =>
    supabase.from('learners').select('id, first_name, last_name').in('id', learnerIds).range(from, to),
  );
  const nameById = new Map(nameRows.map((r) => [r.id, `${r.first_name} ${r.last_name}`]));
  return decorated.map((invoice) => ({ ...invoice, learnerName: nameById.get(invoice.learnerId) }));
}

async function getInvoice(invoiceId: string): Promise<InvoiceWithDetail | null> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [decorated] = await decorate([toInvoice(data)]);
  return decorated ?? null;
}

/** Creates a draft invoice and its line-item charges. The charges are ordinary learner_fee_charges rows tagged with invoice_id, so the derived balance already reflects them. */
async function createInvoice(schoolId: string, learnerId: string, input: CreateInvoiceInput): Promise<Invoice> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      school_id: schoolId,
      learner_id: learnerId,
      academic_year_id: input.academicYearId,
      notes: input.notes?.trim() || null,
      due_date: input.dueDate || null,
    })
    .select('*')
    .single();
  if (error) throw error;

  if (input.lines.length > 0) {
    const { error: chargeError } = await supabase.from('learner_fee_charges').insert(
      input.lines.map((line) => ({
        school_id: schoolId,
        learner_id: learnerId,
        academic_year_id: input.academicYearId,
        invoice_id: invoice.id,
        description: line.description,
        category: line.category,
        amount: line.amount,
        due_date: line.dueDate || input.dueDate || null,
        fee_structure_id: line.feeStructureId || null,
      })),
    );
    if (chargeError) {
      // Roll the draft back so a failed line insert does not leave an empty invoice.
      await supabase.from('invoices').update({ notes: 'FAILED — line items could not be saved' }).eq('id', invoice.id);
      throw chargeError;
    }
  }

  return toInvoice(invoice);
}

async function updateInvoiceDraft(
  invoiceId: string,
  patch: { notes?: string | null; dueDate?: string | null },
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update({ notes: patch.notes ?? null, due_date: patch.dueDate ?? null })
    .eq('id', invoiceId)
    .select('*')
    .single();
  if (error) throw error;
  return toInvoice(data);
}

async function issueInvoice(invoiceId: string, dueDate?: string | null): Promise<Invoice> {
  const { data, error } = await supabase.rpc('issue_fee_invoice', {
    p_invoice_id: invoiceId,
    p_due_date: dueDate ?? null,
  });
  if (error) throw error;
  return toInvoice(data as InvoiceRow);
}

async function voidInvoice(invoiceId: string, reason: string): Promise<Invoice> {
  const { data, error } = await supabase.rpc('void_fee_invoice', { p_invoice_id: invoiceId, p_reason: reason });
  if (error) throw error;
  return toInvoice(data as InvoiceRow);
}

async function allocatePayment(
  paymentId: string,
  allocations: { invoiceId: string; amount: number }[],
): Promise<void> {
  const { error } = await supabase.rpc('allocate_fee_payment', {
    p_payment_id: paymentId,
    p_allocations: allocations.map((a) => ({ invoice_id: a.invoiceId, amount: a.amount })),
  });
  if (error) throw error;
}

async function getAllocationsForPayment(paymentId: string): Promise<PaymentAllocation[]> {
  const { data, error } = await supabase
    .from('learner_fee_payment_allocations')
    .select('*')
    .eq('payment_id', paymentId);
  if (error) throw error;
  return data.map(toAllocation);
}

async function issueReceipt(paymentId: string): Promise<FeeReceipt> {
  const { data, error } = await supabase.rpc('issue_fee_receipt', { p_payment_id: paymentId });
  if (error) throw error;
  return toReceipt(data as FeeReceiptRow);
}

async function getReceiptForPayment(paymentId: string): Promise<FeeReceipt | null> {
  const { data, error } = await supabase.from('fee_receipts').select('*').eq('payment_id', paymentId).maybeSingle();
  if (error) throw error;
  return data ? toReceipt(data) : null;
}

async function listReceiptsForLearner(learnerId: string): Promise<FeeReceipt[]> {
  const { data, error } = await supabase
    .from('fee_receipts')
    .select('*')
    .eq('learner_id', learnerId)
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return data.map(toReceipt);
}

/** A learner's account statement as at `asOf` (defaults to today). Reuses the same ledger fetches feeService uses for the balance. */
async function getLearnerStatement(learnerId: string, asOf?: string): Promise<AccountStatement> {
  const [charges, payments, adjustments, refunds] = await Promise.all([
    feeService.getCharges(learnerId),
    feeService.getPayments(learnerId),
    feeService.getAdjustments(learnerId),
    feeService.getRefunds(learnerId),
  ]);
  return buildAccountStatement({
    charges,
    payments,
    adjustments,
    refunds,
    asOf: asOf ?? new Date().toISOString().slice(0, 10),
  });
}

/** A combined statement across every learner in a family (guardian's linked children). */
async function getFamilyStatement(learnerIds: string[], asOf?: string): Promise<AccountStatement> {
  const perLearner = await Promise.all(
    learnerIds.map(async (id) => {
      const [charges, payments, adjustments, refunds] = await Promise.all([
        feeService.getCharges(id),
        feeService.getPayments(id),
        feeService.getAdjustments(id),
        feeService.getRefunds(id),
      ]);
      return { charges, payments, adjustments, refunds };
    }),
  );
  return buildAccountStatement({
    charges: perLearner.flatMap((l) => l.charges),
    payments: perLearner.flatMap((l) => l.payments),
    adjustments: perLearner.flatMap((l) => l.adjustments),
    refunds: perLearner.flatMap((l) => l.refunds),
    asOf: asOf ?? new Date().toISOString().slice(0, 10),
  });
}

export const invoiceService = {
  listInvoicesForLearner,
  listInvoicesForSchool,
  getInvoice,
  createInvoice,
  updateInvoiceDraft,
  issueInvoice,
  voidInvoice,
  allocatePayment,
  getAllocationsForPayment,
  issueReceipt,
  getReceiptForPayment,
  listReceiptsForLearner,
  getLearnerStatement,
  getFamilyStatement,
};
