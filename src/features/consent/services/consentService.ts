import { supabase } from '@/lib/supabase';
import type { ConsentRecordRow, ConsentRecordInsert } from '@/lib/database.types';
import type { ConsentRecord, SetConsentInput } from '@/features/consent/types/consent.types';

function toConsentRecord(row: ConsentRecordRow): ConsentRecord {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    guardianProfileId: row.guardian_profile_id,
    category: row.category,
    granted: row.granted,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every consent record for one learner — RLS (can_view_learners for staff, is_learner_guardian for a guardian's own rows) is the actual access boundary, not this query. */
async function getRecordsForLearner(learnerId: string): Promise<ConsentRecord[]> {
  const { data, error } = await supabase.from('consent_records').select('*').eq('learner_id', learnerId).order('category', { ascending: true });
  if (error) throw error;
  return data.map(toConsentRecord);
}

/**
 * Grants or withdraws consent for one (learner, guardian, category) —
 * upserts on the table's own unique constraint, so calling this again for
 * the same combination updates the existing row (server-deriving
 * granted_at/revoked_at from the transition) rather than creating a
 * duplicate. Used both by a guardian toggling their own consent and by
 * staff capturing consent on a guardian's behalf (e.g. a paper form) —
 * RLS (consent_records_insert/consent_records_update) is what actually
 * decides which callers may do which.
 */
async function setConsent(schoolId: string, learnerId: string, input: SetConsentInput): Promise<ConsentRecord> {
  const payload: ConsentRecordInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    guardian_profile_id: input.guardianProfileId,
    category: input.category,
    granted: input.granted,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from('consent_records')
    .upsert(payload, { onConflict: 'learner_id,guardian_profile_id,category' })
    .select('*')
    .single();
  if (error) throw error;
  return toConsentRecord(data);
}

export const consentService = { getRecordsForLearner, setConsent };
