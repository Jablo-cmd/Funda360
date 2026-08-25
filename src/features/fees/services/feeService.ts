import { supabase } from '@/lib/supabase';
import type { LearnerFeeChargeRow, LearnerFeeChargeInsert, LearnerFeePaymentRow, LearnerFeePaymentInsert } from '@/lib/database.types';
import type {
  LearnerFeeCharge,
  LearnerFeePayment,
  CreateFeeChargeInput,
  CreateFeePaymentInput,
  LearnerFeeSummary,
} from '@/features/fees/types/fee.types';
import { buildFeeSummary } from '@/features/fees/utils/calculations';

function toCharge(row: LearnerFeeChargeRow): LearnerFeeCharge {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    feeStructureId: row.fee_structure_id,
    description: row.description,
    category: row.category,
    amount: row.amount,
    dueDate: row.due_date,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPayment(row: LearnerFeePaymentRow): LearnerFeePayment {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    amount: row.amount,
    paymentDate: row.payment_date,
    method: row.method,
    reference: row.reference,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every active charge for a learner, most recent first. */
async function getCharges(learnerId: string): Promise<LearnerFeeCharge[]> {
  const { data, error } = await supabase
    .from('learner_fee_charges')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('active', true)
    .order('due_date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data.map(toCharge);
}

/** Every active payment for a learner, most recent first. */
async function getPayments(learnerId: string): Promise<LearnerFeePayment[]> {
  const { data, error } = await supabase
    .from('learner_fee_payments')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('active', true)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data.map(toPayment);
}

/** A learner's derived financial position — see features/fees/utils/calculations.ts for the ledger arithmetic. */
async function getLearnerFeeSummary(learnerId: string): Promise<LearnerFeeSummary> {
  const [charges, payments] = await Promise.all([getCharges(learnerId), getPayments(learnerId)]);
  const today = new Date().toISOString().slice(0, 10);
  return buildFeeSummary(charges, payments, today);
}

async function createCharge(schoolId: string, learnerId: string, input: CreateFeeChargeInput): Promise<LearnerFeeCharge> {
  const payload: LearnerFeeChargeInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    description: input.description,
    category: input.category,
    amount: input.amount,
    due_date: input.dueDate || null,
    notes: input.notes || null,
  };
  const { data, error } = await supabase.from('learner_fee_charges').insert(payload).select('*').single();
  if (error) throw error;
  return toCharge(data);
}

/** Never hard-deleted (no DELETE RLS policy) — a charge entered in error is excluded from the balance via active: false. */
async function voidCharge(id: string): Promise<LearnerFeeCharge> {
  const { data, error } = await supabase
    .from('learner_fee_charges')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toCharge(data);
}

async function createPayment(
  schoolId: string,
  learnerId: string,
  input: CreateFeePaymentInput,
): Promise<LearnerFeePayment> {
  const payload: LearnerFeePaymentInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    amount: input.amount,
    payment_date: input.paymentDate,
    method: input.method,
    reference: input.reference || null,
    notes: input.notes || null,
  };
  const { data, error } = await supabase.from('learner_fee_payments').insert(payload).select('*').single();
  if (error) throw error;
  return toPayment(data);
}

/** Never hard-deleted (no DELETE RLS policy) — a payment entered in error is excluded from the balance via active: false. */
async function voidPayment(id: string): Promise<LearnerFeePayment> {
  const { data, error } = await supabase
    .from('learner_fee_payments')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toPayment(data);
}

export const feeService = {
  getCharges,
  getPayments,
  getLearnerFeeSummary,
  createCharge,
  voidCharge,
  createPayment,
  voidPayment,
};
