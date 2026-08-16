import { supabase } from '@/lib/supabase';
import type { LearnerGuardianRow, LearnerGuardianInsert, LearnerGuardianUpdate } from '@/lib/database.types';
import type { LearnerGuardian, CreateLearnerGuardianInput, UpdateLearnerGuardianInput } from '@/features/learners/types/learner.types';

export interface GuardianCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Guardians are existing profiles (role=parent/guardian), not a new entity
 * (see learner_management migration) — this searches those profiles for the
 * picker in GuardianFormModal rather than duplicating userService's
 * single-role filter shape.
 */
async function searchGuardianCandidates(schoolId: string, search = ''): Promise<GuardianCandidate[]> {
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', schoolId)
    .in('role', ['parent', 'guardian']);

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,]/g, '');
    query = query.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data, error } = await query.order('first_name', { ascending: true }).limit(20);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email }));
}

export function toLearnerGuardian(row: LearnerGuardianRow): LearnerGuardian {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    guardianProfileId: row.guardian_profile_id,
    relationshipType: row.relationship_type,
    isPrimary: row.is_primary,
    custodyNotes: row.custody_notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getGuardians(learnerId: string): Promise<LearnerGuardian[]> {
  const { data, error } = await supabase
    .from('learner_guardians')
    .select('*')
    .eq('learner_id', learnerId)
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return data.map(toLearnerGuardian);
}

async function createGuardian(
  schoolId: string,
  learnerId: string,
  input: CreateLearnerGuardianInput,
): Promise<LearnerGuardian> {
  const payload: LearnerGuardianInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    guardian_profile_id: input.guardianProfileId,
    relationship_type: input.relationshipType,
    is_primary: input.isPrimary ?? false,
    custody_notes: input.custodyNotes ?? null,
  };
  const { data, error } = await supabase.from('learner_guardians').insert(payload).select('*').single();
  if (error) throw error;
  return toLearnerGuardian(data);
}

/** Batch profile lookup for rendering guardian names — avoids the 20-row limit on searchGuardianCandidates. */
async function getGuardianCandidatesByIds(ids: string[]): Promise<GuardianCandidate[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, email').in('id', ids);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email }));
}

async function updateGuardian(id: string, updates: UpdateLearnerGuardianInput): Promise<LearnerGuardian> {
  const payload: LearnerGuardianUpdate = {};
  if (updates.relationshipType !== undefined) payload.relationship_type = updates.relationshipType;
  if (updates.isPrimary !== undefined) payload.is_primary = updates.isPrimary;
  if (updates.custodyNotes !== undefined) payload.custody_notes = updates.custodyNotes;

  const { data, error } = await supabase.from('learner_guardians').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toLearnerGuardian(data);
}

/**
 * Never hard-deleted (no DELETE RLS policy exists for this table) —
 * archiving sets active: false, which also immediately revokes the
 * guardian's RLS-derived read access (is_learner_guardian() only
 * recognises active links). Also clears is_primary so a later guardian can
 * be marked primary without colliding with the one-primary-per-learner
 * partial unique index.
 */
async function archiveGuardian(id: string): Promise<LearnerGuardian> {
  const { data, error } = await supabase
    .from('learner_guardians')
    .update({ active: false, is_primary: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toLearnerGuardian(data);
}

async function restoreGuardian(id: string): Promise<LearnerGuardian> {
  const { data, error } = await supabase
    .from('learner_guardians')
    .update({ active: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toLearnerGuardian(data);
}

export const guardianService = {
  getGuardians,
  createGuardian,
  updateGuardian,
  archiveGuardian,
  restoreGuardian,
  searchGuardianCandidates,
  getGuardianCandidatesByIds,
};
