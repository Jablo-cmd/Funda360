import { supabase } from '@/lib/supabase';
import type { LearnerGuardianRow, LearnerGuardianInsert, LearnerGuardianUpdate } from '@/lib/database.types';
import type { LearnerGuardian, CreateLearnerGuardianInput, UpdateLearnerGuardianInput } from '@/features/learners/types/learner.types';

export interface GuardianCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
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
    .select('id, first_name, last_name, email, phone')
    .eq('tenant_id', schoolId)
    .in('role', ['parent', 'guardian']);

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,]/g, '');
    query = query.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data, error } = await query.order('first_name', { ascending: true }).limit(20);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, phone: row.phone }));
}

export function toLearnerGuardian(row: LearnerGuardianRow): LearnerGuardian {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    guardianProfileId: row.guardian_profile_id,
    relationshipType: row.relationship_type,
    isPrimary: row.is_primary,
    isEmergencyContact: row.is_emergency_contact,
    isAuthorizedPickup: row.is_authorized_pickup,
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
    is_emergency_contact: input.isEmergencyContact ?? false,
    is_authorized_pickup: input.isAuthorizedPickup ?? false,
    custody_notes: input.custodyNotes ?? null,
  };
  const { data, error } = await supabase.from('learner_guardians').insert(payload).select('*').single();
  if (error) throw error;
  return toLearnerGuardian(data);
}

export interface CreateGuardianProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  idNumber?: string | null;
}

/**
 * Creates a brand-new guardian (profiles row, role=guardian) via
 * admin_create_guardian() — for when GuardianFormModal's search finds no
 * existing candidate. Gated server-side by can_manage_learners(), not the
 * staff role-assignment ladder admin_create_user() uses (see the
 * guardian_management migration). Returns a GuardianCandidate directly so
 * the caller can select it immediately without a second round-trip.
 */
async function createGuardianProfile(input: CreateGuardianProfileInput): Promise<GuardianCandidate> {
  const { data, error } = await supabase.rpc('admin_create_guardian', {
    p_email: input.email,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone || null,
    p_address: input.address || null,
    p_id_number: input.idNumber || null,
  });
  if (error) throw error;
  const created = data[0];
  if (!created) throw new Error('admin_create_guardian returned no result');
  return { id: created.user_id, firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone || null };
}

/** Batch profile lookup for rendering guardian names — avoids the 20-row limit on searchGuardianCandidates. */
async function getGuardianCandidatesByIds(ids: string[]): Promise<GuardianCandidate[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, email, phone').in('id', ids);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, phone: row.phone }));
}

async function updateGuardian(id: string, updates: UpdateLearnerGuardianInput): Promise<LearnerGuardian> {
  const payload: LearnerGuardianUpdate = {};
  if (updates.relationshipType !== undefined) payload.relationship_type = updates.relationshipType;
  if (updates.isPrimary !== undefined) payload.is_primary = updates.isPrimary;
  if (updates.isEmergencyContact !== undefined) payload.is_emergency_contact = updates.isEmergencyContact;
  if (updates.isAuthorizedPickup !== undefined) payload.is_authorized_pickup = updates.isAuthorizedPickup;
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
  createGuardianProfile,
};
