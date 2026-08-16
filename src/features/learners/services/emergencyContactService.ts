import { supabase } from '@/lib/supabase';
import type { LearnerEmergencyContactRow, LearnerEmergencyContactInsert, LearnerEmergencyContactUpdate } from '@/lib/database.types';
import type {
  LearnerEmergencyContact,
  CreateLearnerEmergencyContactInput,
  UpdateLearnerEmergencyContactInput,
} from '@/features/learners/types/learner.types';

export function toLearnerEmergencyContact(row: LearnerEmergencyContactRow): LearnerEmergencyContact {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    name: row.name,
    relationship: row.relationship,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getEmergencyContacts(learnerId: string): Promise<LearnerEmergencyContact[]> {
  const { data, error } = await supabase
    .from('learner_emergency_contacts')
    .select('*')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(toLearnerEmergencyContact);
}

async function createEmergencyContact(
  schoolId: string,
  learnerId: string,
  input: CreateLearnerEmergencyContactInput,
): Promise<LearnerEmergencyContact> {
  const payload: LearnerEmergencyContactInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    name: input.name,
    relationship: input.relationship ?? null,
    phone: input.phone,
    alternate_phone: input.alternatePhone ?? null,
  };
  const { data, error } = await supabase.from('learner_emergency_contacts').insert(payload).select('*').single();
  if (error) throw error;
  return toLearnerEmergencyContact(data);
}

async function updateEmergencyContact(id: string, updates: UpdateLearnerEmergencyContactInput): Promise<LearnerEmergencyContact> {
  const payload: LearnerEmergencyContactUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.relationship !== undefined) payload.relationship = updates.relationship;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.alternatePhone !== undefined) payload.alternate_phone = updates.alternatePhone;

  const { data, error } = await supabase.from('learner_emergency_contacts').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toLearnerEmergencyContact(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false, same pattern as documentService. */
async function archiveEmergencyContact(id: string): Promise<LearnerEmergencyContact> {
  const { data, error } = await supabase
    .from('learner_emergency_contacts')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toLearnerEmergencyContact(data);
}

async function restoreEmergencyContact(id: string): Promise<LearnerEmergencyContact> {
  const { data, error } = await supabase
    .from('learner_emergency_contacts')
    .update({ active: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toLearnerEmergencyContact(data);
}

export const emergencyContactService = {
  getEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  archiveEmergencyContact,
  restoreEmergencyContact,
};
