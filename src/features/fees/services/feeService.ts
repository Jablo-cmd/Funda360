import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/pagination';
import type {
  LearnerFeeChargeRow,
  LearnerFeeChargeInsert,
  LearnerFeePaymentRow,
  LearnerFeePaymentInsert,
  LearnerFeeAdjustmentRow,
  LearnerFeeAdjustmentInsert,
  LearnerFeeRefundRow,
  LearnerFeeRefundInsert,
  LearnerFeeRefundUpdate,
  FeeStructureRow,
} from '@/lib/database.types';
import type {
  LearnerFeeCharge,
  LearnerFeePayment,
  LearnerFeeAdjustment,
  LearnerFeeRefund,
  CreateFeeChargeInput,
  CreateFeePaymentInput,
  CreateFeeAdjustmentInput,
  CreateFeeRefundInput,
  LearnerFeeSummary,
  FeeStatus,
} from '@/features/fees/types/fee.types';
import type { FeeStructure, CreateFeeStructureInput } from '@/features/fees/types/feeStructure.types';
import { buildFeeSummary } from '@/features/fees/utils/calculations';
import { sumMoney, addMoney, subtractMoney } from '@/lib/money';

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
    reconciledAt: row.reconciled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAdjustment(row: LearnerFeeAdjustmentRow): LearnerFeeAdjustment {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    chargeId: row.charge_id,
    adjustmentType: row.adjustment_type,
    method: row.method,
    percentage: row.percentage,
    amount: row.amount,
    reason: row.reason,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRefund(row: LearnerFeeRefundRow): LearnerFeeRefund {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    paymentId: row.payment_id,
    amount: row.amount,
    refundDate: row.refund_date,
    method: row.method,
    reference: row.reference,
    reason: row.reason,
    status: row.status,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFeeStructure(row: FeeStructureRow): FeeStructure {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    gradeId: row.grade_id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    description: row.description,
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

/** Every active discount/bursary/scholarship/waiver for a learner, most recent first. */
async function getAdjustments(learnerId: string): Promise<LearnerFeeAdjustment[]> {
  const { data, error } = await supabase
    .from('learner_fee_adjustments')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toAdjustment);
}

/** Every active refund for a learner, most recent first. */
async function getRefunds(learnerId: string): Promise<LearnerFeeRefund[]> {
  const { data, error } = await supabase
    .from('learner_fee_refunds')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('active', true)
    .order('refund_date', { ascending: false });
  if (error) throw error;
  return data.map(toRefund);
}

/** A learner's derived financial position — see features/fees/utils/calculations.ts for the ledger arithmetic. */
async function getLearnerFeeSummary(learnerId: string): Promise<LearnerFeeSummary> {
  const [charges, payments, adjustments, refunds] = await Promise.all([
    getCharges(learnerId),
    getPayments(learnerId),
    getAdjustments(learnerId),
    getRefunds(learnerId),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return buildFeeSummary(charges, payments, adjustments, refunds, today);
}

async function createCharge(schoolId: string, learnerId: string, input: CreateFeeChargeInput): Promise<LearnerFeeCharge> {
  const payload: LearnerFeeChargeInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    fee_structure_id: input.feeStructureId || null,
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

async function createAdjustment(
  schoolId: string,
  learnerId: string,
  input: CreateFeeAdjustmentInput,
): Promise<LearnerFeeAdjustment> {
  const payload: LearnerFeeAdjustmentInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    charge_id: input.chargeId || null,
    adjustment_type: input.adjustmentType,
    method: input.method,
    percentage: input.method === 'percentage' ? input.percentage ?? null : null,
    amount: input.amount,
    reason: input.reason,
  };
  const { data, error } = await supabase.from('learner_fee_adjustments').insert(payload).select('*').single();
  if (error) throw error;
  return toAdjustment(data);
}

/** Never hard-deleted — an adjustment entered in error is excluded from the balance via active: false. */
async function voidAdjustment(id: string): Promise<LearnerFeeAdjustment> {
  const { data, error } = await supabase
    .from('learner_fee_adjustments')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toAdjustment(data);
}

/**
 * Creates a refund request against a specific payment. The database
 * (learner_fee_refunds_validate_tenant()) is the authoritative check that
 * the amount never exceeds the payment's remaining refundable balance —
 * this call surfaces that rejection via getDbErrorMessage, it does not
 * re-validate client-side as the source of truth.
 */
async function createRefund(schoolId: string, learnerId: string, input: CreateFeeRefundInput): Promise<LearnerFeeRefund> {
  const payload: LearnerFeeRefundInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    payment_id: input.paymentId,
    amount: input.amount,
    refund_date: input.refundDate,
    method: input.method,
    reference: input.reference || null,
    reason: input.reason,
    status: input.status ?? 'pending',
  };
  const { data, error } = await supabase.from('learner_fee_refunds').insert(payload).select('*').single();
  if (error) throw error;
  return toRefund(data);
}

/** Moves a refund to completed/rejected — only a completed refund reduces the derived balance (see calculations.ts). */
async function updateRefundStatus(id: string, status: LearnerFeeRefundUpdate['status']): Promise<LearnerFeeRefund> {
  const { data, error } = await supabase
    .from('learner_fee_refunds')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toRefund(data);
}

/** Never hard-deleted — a refund entered in error is excluded via active: false, distinct from status='rejected' (a real request that was declined). */
async function voidRefund(id: string): Promise<LearnerFeeRefund> {
  const { data, error } = await supabase
    .from('learner_fee_refunds')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toRefund(data);
}

/** The school's reusable fee catalogue for a given academic year (optionally narrowed by grade). Previously defined in the schema but never queried by the frontend — now the source FeeChargeFormModal can pick a template from. */
async function getFeeStructures(schoolId: string, academicYearId: string): Promise<FeeStructure[]> {
  const { data, error } = await supabase
    .from('fee_structures')
    .select('*')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data.map(toFeeStructure);
}

async function createFeeStructure(schoolId: string, input: CreateFeeStructureInput): Promise<FeeStructure> {
  const { data, error } = await supabase
    .from('fee_structures')
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      grade_id: input.gradeId || null,
      name: input.name,
      category: input.category,
      amount: input.amount,
      description: input.description || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return toFeeStructure(data);
}

/** Never hard-deleted — a retired fee-structure template is excluded from future selection via active: false; charges already created from it are untouched. */
async function archiveFeeStructure(id: string): Promise<FeeStructure> {
  const { data, error } = await supabase.from('fee_structures').update({ active: false }).eq('id', id).select('*').single();
  if (error) throw error;
  return toFeeStructure(data);
}

export interface LearnerFinanceBalanceRow {
  learnerId: string;
  learnerNumber: string;
  learnerName: string;
  status: FeeStatus;
  totalCharged: number;
  netPaid: number;
  outstandingBalance: number;
}

export interface SchoolFinanceOverview {
  totalCharged: number;
  totalAdjustments: number;
  totalPaid: number;
  totalRefunded: number;
  netPaid: number;
  outstandingBalance: number;
  overdueBalance: number;
  learnerCount: number;
  statusCounts: Record<FeeStatus, number>;
  agingBuckets: { current: number; days30: number; days60: number; days90Plus: number };
  /** The debtor list — one row per learner with any charge/payment activity this year, sorted by outstanding balance descending (who owes the most, first). FND-FIN-013. */
  learnerBalances: LearnerFinanceBalanceRow[];
}

/**
 * School-wide finance position for a given academic year — powers the new
 * Finance Overview report. Pulls the same raw ledger rows the per-learner
 * summary uses (no separate stored aggregate table) and reduces them with
 * the same calculations module, so the two views can never disagree.
 */
async function getSchoolFinanceOverview(schoolId: string, academicYearId: string): Promise<SchoolFinanceOverview> {
  // FND-QA-003: paged via fetchAllRows — a school-wide, whole-year fetch
  // across four ledger tables is exactly the "true complete set" case
  // that can exceed PostgREST's 1000-row default cap once a school
  // reaches realistic scale, which would otherwise silently under-report
  // the collection rate / outstanding balance this page exists to show.
  const [chargesData, paymentsData, adjustmentsData, refundsData] = await Promise.all([
    fetchAllRows<LearnerFeeChargeRow>((from, to) =>
      supabase.from('learner_fee_charges').select('*').eq('school_id', schoolId).eq('academic_year_id', academicYearId).eq('active', true).range(from, to),
    ),
    fetchAllRows<LearnerFeePaymentRow>((from, to) =>
      supabase.from('learner_fee_payments').select('*').eq('school_id', schoolId).eq('academic_year_id', academicYearId).eq('active', true).range(from, to),
    ),
    fetchAllRows<LearnerFeeAdjustmentRow>((from, to) =>
      supabase.from('learner_fee_adjustments').select('*').eq('school_id', schoolId).eq('academic_year_id', academicYearId).eq('active', true).range(from, to),
    ),
    fetchAllRows<LearnerFeeRefundRow>((from, to) =>
      supabase.from('learner_fee_refunds').select('*').eq('school_id', schoolId).eq('academic_year_id', academicYearId).eq('active', true).range(from, to),
    ),
  ]);

  const charges = chargesData.map(toCharge);
  const payments = paymentsData.map(toPayment);
  const adjustments = adjustmentsData.map(toAdjustment);
  const refunds = refundsData.map(toRefund);

  const today = new Date().toISOString().slice(0, 10);
  const learnerIds = new Set<string>();
  charges.forEach((c) => learnerIds.add(c.learnerId));
  payments.forEach((p) => learnerIds.add(p.learnerId));

  const statusCounts: Record<FeeStatus, number> = { paid: 0, partially_paid: 0, outstanding: 0, overdue: 0 };
  const agingBuckets = { current: 0, days30: 0, days60: 0, days90Plus: 0 };
  const learnerBalances: LearnerFinanceBalanceRow[] = [];
  let overdueBalance = 0;

  const learnerNamesById = new Map<string, { name: string; number: string }>();
  if (learnerIds.size > 0) {
    const learnerRows = await fetchAllRows<{ id: string; first_name: string; last_name: string; learner_number: string }>((from, to) =>
      supabase.from('learners').select('id, first_name, last_name, learner_number').in('id', [...learnerIds]).range(from, to),
    );
    for (const row of learnerRows) learnerNamesById.set(row.id, { name: `${row.first_name} ${row.last_name}`, number: row.learner_number });
  }

  for (const learnerId of learnerIds) {
    const learnerCharges = charges.filter((c) => c.learnerId === learnerId);
    const learnerPayments = payments.filter((p) => p.learnerId === learnerId);
    const learnerAdjustments = adjustments.filter((a) => a.learnerId === learnerId);
    const learnerRefunds = refunds.filter((r) => r.learnerId === learnerId);
    const summary = buildFeeSummary(learnerCharges, learnerPayments, learnerAdjustments, learnerRefunds, today);
    statusCounts[summary.status] += 1;

    const identity = learnerNamesById.get(learnerId);
    learnerBalances.push({
      learnerId,
      learnerNumber: identity?.number ?? '—',
      learnerName: identity?.name ?? 'Unknown learner',
      status: summary.status,
      totalCharged: summary.totalCharged,
      netPaid: summary.netPaid,
      outstandingBalance: summary.outstandingBalance,
    });

    if (summary.outstandingBalance > 0) {
      if (summary.status === 'overdue') overdueBalance = addMoney(overdueBalance, summary.outstandingBalance);
      const oldestOverdueDue = learnerCharges
        .filter((c) => c.dueDate !== null && c.dueDate < today)
        .map((c) => c.dueDate as string)
        .sort()[0];
      if (!oldestOverdueDue) {
        agingBuckets.current = addMoney(agingBuckets.current, summary.outstandingBalance);
      } else {
        const daysOverdue = Math.floor((Date.parse(today) - Date.parse(oldestOverdueDue)) / 86_400_000);
        if (daysOverdue <= 30) agingBuckets.current = addMoney(agingBuckets.current, summary.outstandingBalance);
        else if (daysOverdue <= 60) agingBuckets.days30 = addMoney(agingBuckets.days30, summary.outstandingBalance);
        else if (daysOverdue <= 90) agingBuckets.days60 = addMoney(agingBuckets.days60, summary.outstandingBalance);
        else agingBuckets.days90Plus = addMoney(agingBuckets.days90Plus, summary.outstandingBalance);
      }
    }
  }

  // FND-FIN-009: decimal-safe (src/lib/money.ts) — a plain `reduce((sum, x) =>
  // sum + x.amount, 0)` across a whole school's ledger is exactly the kind of
  // many-rows-summed arithmetic where IEEE 754 float drift shows up.
  const totalCharged = sumMoney(charges.map((c) => c.amount));
  const totalAdjustments = sumMoney(adjustments.map((a) => a.amount));
  const totalPaid = sumMoney(payments.map((p) => p.amount));
  const totalRefunded = sumMoney(refunds.filter((r) => r.status === 'completed').map((r) => r.amount));
  const netPaid = subtractMoney(totalPaid, totalRefunded);
  const outstandingBalance = Math.max(0, subtractMoney(subtractMoney(totalCharged, totalAdjustments), netPaid));

  learnerBalances.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  return {
    totalCharged,
    totalAdjustments,
    totalPaid,
    totalRefunded,
    netPaid,
    outstandingBalance,
    overdueBalance,
    learnerCount: learnerIds.size,
    statusCounts,
    agingBuckets,
    learnerBalances,
  };
}

/**
 * Manually fires the same fee-overdue reminder/escalation worker the daily
 * pg_cron job runs — reminders to guardians (7-day cooldown), escalation
 * to finance staff for anything 14+ days overdue (14-day cooldown). See
 * trigger_fee_overdue_reminders()/run_fee_overdue_reminders()
 * (20260829150000_fee_overdue_reminders.sql). Returns the number of
 * notifications actually sent — 0 is a normal, expected result when
 * everything currently overdue is still within its cooldown window, not
 * an error.
 */
async function triggerOverdueReminders(schoolId: string): Promise<number> {
  const { data, error } = await supabase.rpc('trigger_fee_overdue_reminders', { p_school_id: schoolId });
  if (error) throw error;
  return data;
}

export const feeService = {
  getCharges,
  getPayments,
  getAdjustments,
  getRefunds,
  getLearnerFeeSummary,
  createCharge,
  voidCharge,
  createPayment,
  voidPayment,
  createAdjustment,
  voidAdjustment,
  createRefund,
  updateRefundStatus,
  voidRefund,
  getFeeStructures,
  createFeeStructure,
  archiveFeeStructure,
  getSchoolFinanceOverview,
  triggerOverdueReminders,
};
