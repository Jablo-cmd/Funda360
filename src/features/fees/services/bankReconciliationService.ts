import { supabase } from '@/lib/supabase';
import type { BankReconciliationImportRow, BankStatementLineRow, BankStatementLineInsert, FeePaymentMethod } from '@/lib/database.types';
import type { BankReconciliationImport, BankStatementLine, NewBankStatementLine } from '@/features/fees/types/bankReconciliation.types';

export interface UnreconciledPayment {
  id: string;
  learnerId: string;
  amount: number;
  paymentDate: string;
  method: FeePaymentMethod;
  reference: string | null;
}

function toImport(row: BankReconciliationImportRow): BankReconciliationImport {
  return { id: row.id, schoolId: row.school_id, fileName: row.file_name, importedAt: row.imported_at };
}

function toLine(row: BankStatementLineRow): BankStatementLine {
  return {
    id: row.id,
    schoolId: row.school_id,
    importId: row.import_id,
    transactionDate: row.transaction_date,
    description: row.description,
    amount: row.amount,
    status: row.status,
    matchedPaymentId: row.matched_payment_id,
    matchedAt: row.matched_at,
  };
}

/** Every uploaded statement for the school, most recent first. */
async function getImports(schoolId: string): Promise<BankReconciliationImport[]> {
  const { data, error } = await supabase.from('bank_reconciliation_imports').select('*').eq('school_id', schoolId).order('imported_at', { ascending: false });
  if (error) throw error;
  return data.map(toImport);
}

/** Every line from every statement for the school — the reconciliation workspace shows all of them together, not one statement at a time, since an unmatched line from last month is still worth resolving. */
async function getLines(schoolId: string): Promise<BankStatementLine[]> {
  const { data, error } = await supabase.from('bank_statement_lines').select('*').eq('school_id', schoolId).order('transaction_date', { ascending: false });
  if (error) throw error;
  return data.map(toLine);
}

/** Creates the import row, then every parsed line under it, in one statement upload. */
async function uploadStatement(schoolId: string, fileName: string, lines: NewBankStatementLine[]): Promise<BankReconciliationImport> {
  const { data: importRow, error: importError } = await supabase
    .from('bank_reconciliation_imports')
    .insert({ school_id: schoolId, file_name: fileName })
    .select('*')
    .single();
  if (importError) throw importError;

  if (lines.length > 0) {
    const payload: BankStatementLineInsert[] = lines.map((line) => ({
      school_id: schoolId,
      import_id: importRow.id,
      transaction_date: line.transactionDate,
      description: line.description,
      amount: line.amount,
    }));
    const { error: linesError } = await supabase.from('bank_statement_lines').insert(payload);
    if (linesError) throw linesError;
  }

  return toImport(importRow);
}

/** Unreconciled fee payments for the school — the pool a statement line can be matched against. RLS (can_view_learner_financial) is the real access boundary. */
async function getUnreconciledPayments(schoolId: string): Promise<UnreconciledPayment[]> {
  const { data, error } = await supabase
    .from('learner_fee_payments')
    .select('id, learner_id, amount, payment_date, method, reference')
    .eq('school_id', schoolId)
    .is('reconciled_at', null)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ id: row.id, learnerId: row.learner_id, amount: row.amount, paymentDate: row.payment_date, method: row.method, reference: row.reference }));
}

/** Batch lookup for already-matched payments (rendering "matched to X" on a matched line) — a separate query from getUnreconciledPayments since a matched payment is, by definition, no longer in that pool. */
async function getPaymentsByIds(ids: string[]): Promise<UnreconciledPayment[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('learner_fee_payments')
    .select('id, learner_id, amount, payment_date, method, reference')
    .in('id', [...new Set(ids)]);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, learnerId: row.learner_id, amount: row.amount, paymentDate: row.payment_date, method: row.method, reference: row.reference }));
}

/** Batch learner-name lookup for rendering candidate payments — mirrors guardianService.getGuardianCandidatesByIds's own "avoid an N+1 of single lookups" reasoning. */
async function getLearnerNamesByIds(ids: string[]): Promise<Record<string, { firstName: string; lastName: string; learnerNumber: string }>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from('learners').select('id, first_name, last_name, learner_number').in('id', [...new Set(ids)]);
  if (error) throw error;
  const map: Record<string, { firstName: string; lastName: string; learnerNumber: string }> = {};
  for (const row of data) map[row.id] = { firstName: row.first_name, lastName: row.last_name, learnerNumber: row.learner_number };
  return map;
}

async function reconcile(lineId: string, paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('reconcile_bank_statement_line', { p_line_id: lineId, p_payment_id: paymentId });
  if (error) throw error;
}

async function unreconcile(lineId: string): Promise<void> {
  const { error } = await supabase.rpc('unreconcile_bank_statement_line', { p_line_id: lineId });
  if (error) throw error;
}

async function ignoreLine(lineId: string): Promise<void> {
  const { error } = await supabase.from('bank_statement_lines').update({ status: 'ignored' }).eq('id', lineId);
  if (error) throw error;
}

async function unignoreLine(lineId: string): Promise<void> {
  const { error } = await supabase.from('bank_statement_lines').update({ status: 'unmatched' }).eq('id', lineId);
  if (error) throw error;
}

export const bankReconciliationService = {
  getImports,
  getLines,
  uploadStatement,
  getUnreconciledPayments,
  getPaymentsByIds,
  getLearnerNamesByIds,
  reconcile,
  unreconcile,
  ignoreLine,
  unignoreLine,
};
