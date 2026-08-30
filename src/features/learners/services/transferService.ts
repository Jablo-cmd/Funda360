import { supabase } from '@/lib/supabase';
import type { LearnerTransferRow, LearnerTransferInsert } from '@/lib/database.types';
import type { LearnerTransfer, CreateLearnerTransferInput } from '@/features/learners/types/learner.types';

function toLearnerTransfer(row: LearnerTransferRow): LearnerTransfer {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    direction: row.direction,
    otherSchoolName: row.other_school_name,
    otherSchoolContact: row.other_school_contact,
    transferDate: row.transfer_date,
    reason: row.reason,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

async function getTransfers(learnerId: string): Promise<LearnerTransfer[]> {
  const { data, error } = await supabase
    .from('learner_transfers')
    .select('*')
    .eq('learner_id', learnerId)
    .order('transfer_date', { ascending: false });
  if (error) throw error;
  return data.map(toLearnerTransfer);
}

/**
 * Records the transfer's details only — this does NOT change the
 * learner's own status. An outgoing transfer's caller is responsible for
 * separately calling learnerService.changeStatus(learner, 'transferred')
 * (already valid from 'active' per learners_validate_status_transition());
 * keeping these as two explicit calls rather than bundling them into one
 * RPC mirrors this table's own migration-header reasoning — the status
 * transition and the transfer record are two independently useful facts,
 * not one compound action every caller is forced to take together (e.g.
 * an incoming transfer's history is recorded with no status change at all).
 */
async function createTransfer(
  schoolId: string,
  learnerId: string,
  input: CreateLearnerTransferInput,
): Promise<LearnerTransfer> {
  const payload: LearnerTransferInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    direction: input.direction,
    other_school_name: input.otherSchoolName,
    other_school_contact: input.otherSchoolContact ?? null,
    transfer_date: input.transferDate,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase.from('learner_transfers').insert(payload).select('*').single();
  if (error) throw error;
  return toLearnerTransfer(data);
}

export const transferService = { getTransfers, createTransfer };
