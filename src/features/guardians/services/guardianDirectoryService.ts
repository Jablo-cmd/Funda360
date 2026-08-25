import { supabase } from '@/lib/supabase';
import { guardianService } from '@/features/learners/services/guardianService';
import { guardianInvitationService } from '@/features/guardians/services/guardianInvitationService';
import type {
  GuardianDirectoryEntry,
  GuardianProfileDetail,
  GuardianLearnerLink,
  GuardiansListFilters,
  CreateGuardianDirectoryInput,
  UpdateGuardianDetailsInput,
} from '@/features/guardians/types/guardian.types';

/**
 * No embedded/nested PostgREST selects anywhere in this codebase — the
 * hand-written Database type (src/lib/database.types.ts) carries no
 * Relationships metadata for supabase-js to validate or type an embedded
 * query against. Every directory query here is therefore the same
 * multi-step batch-fetch-by-id pattern guardianService.ts already
 * established (getGuardianCandidatesByIds), not new embedding syntax.
 */

async function fetchLinksForGuardians(guardianProfileIds: string[]): Promise<Map<string, GuardianLearnerLink[]>> {
  const linksByGuardian = new Map<string, GuardianLearnerLink[]>();
  if (guardianProfileIds.length === 0) return linksByGuardian;

  const { data: linkRows, error: linkError } = await supabase
    .from('learner_guardians')
    .select('id, learner_id, guardian_profile_id, relationship_type, is_primary, is_emergency_contact, is_authorized_pickup, custody_notes, active')
    .in('guardian_profile_id', guardianProfileIds);
  if (linkError) throw linkError;

  const learnerIds = [...new Set(linkRows.map((row) => row.learner_id))];
  const learnerNamesById = new Map<string, { firstName: string; lastName: string }>();
  if (learnerIds.length > 0) {
    const { data: learnerRows, error: learnerError } = await supabase
      .from('learners')
      .select('id, first_name, last_name')
      .in('id', learnerIds);
    if (learnerError) throw learnerError;
    for (const learner of learnerRows) learnerNamesById.set(learner.id, { firstName: learner.first_name, lastName: learner.last_name });
  }

  for (const row of linkRows) {
    const name = learnerNamesById.get(row.learner_id);
    const link: GuardianLearnerLink = {
      relationshipId: row.id,
      learnerId: row.learner_id,
      learnerFirstName: name?.firstName ?? '',
      learnerLastName: name?.lastName ?? '',
      relationshipType: row.relationship_type,
      isPrimary: row.is_primary,
      isEmergencyContact: row.is_emergency_contact,
      isAuthorizedPickup: row.is_authorized_pickup,
      custodyNotes: row.custody_notes,
      active: row.active,
    };
    const existing = linksByGuardian.get(row.guardian_profile_id);
    if (existing) existing.push(link);
    else linksByGuardian.set(row.guardian_profile_id, [link]);
  }

  return linksByGuardian;
}

async function fetchDetailsForGuardians(guardianProfileIds: string[]): Promise<Map<string, { address: string | null; idNumber: string | null }>> {
  const detailsByGuardian = new Map<string, { address: string | null; idNumber: string | null }>();
  if (guardianProfileIds.length === 0) return detailsByGuardian;

  const { data, error } = await supabase
    .from('guardian_profile_details')
    .select('guardian_profile_id, address, id_number')
    .in('guardian_profile_id', guardianProfileIds);
  if (error) throw error;
  for (const row of data) detailsByGuardian.set(row.guardian_profile_id, { address: row.address, idNumber: row.id_number });
  return detailsByGuardian;
}

export interface GuardiansListResult {
  guardians: GuardianDirectoryEntry[];
  totalCount: number;
}

/**
 * Directory-level query across every guardian in the school. When
 * filtering by learner or relationship type, first narrows to the matching
 * guardian_profile_ids via learner_guardians (a plain filtered SELECT,
 * already RLS-scoped to can_view_learners()), then filters the profiles
 * page by that id set — same two-step shape as
 * guardianService.getGuardianCandidatesByIds, just applied to a list
 * instead of a fixed batch.
 */
async function listGuardians(
  schoolId: string,
  filters: GuardiansListFilters,
  page: number,
  pageSize: number,
): Promise<GuardiansListResult> {
  let restrictToIds: string[] | null = null;

  if (filters.learnerId || filters.relationshipType) {
    let linkQuery = supabase.from('learner_guardians').select('guardian_profile_id').eq('school_id', schoolId);
    if (filters.learnerId) linkQuery = linkQuery.eq('learner_id', filters.learnerId);
    if (filters.relationshipType) linkQuery = linkQuery.eq('relationship_type', filters.relationshipType);
    const { data: linkRows, error: linkError } = await linkQuery;
    if (linkError) throw linkError;
    restrictToIds = [...new Set(linkRows.map((row) => row.guardian_profile_id))];
    if (restrictToIds.length === 0) return { guardians: [], totalCount: 0 };
  }

  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, status', { count: 'exact' })
    .eq('tenant_id', schoolId)
    .in('role', ['parent', 'guardian']);

  if (restrictToIds) query = query.in('id', restrictToIds);

  const search = filters.search?.trim();
  if (search) {
    const escaped = search.replace(/[%,]/g, '');
    query = query.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  const from = (page - 1) * pageSize;
  const { data: profileRows, error, count } = await query.order('first_name', { ascending: true }).range(from, from + pageSize - 1);
  if (error) throw error;

  const ids = profileRows.map((row) => row.id);
  const [linksByGuardian, invitationsByGuardian] = await Promise.all([
    fetchLinksForGuardians(ids),
    guardianInvitationService.getInvitationsForGuardians(ids),
  ]);

  const guardians: GuardianDirectoryEntry[] = profileRows.map((row) => ({
    guardianProfileId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    links: linksByGuardian.get(row.id) ?? [],
    invitation: invitationsByGuardian.get(row.id) ?? null,
  }));

  return { guardians, totalCount: count ?? 0 };
}

async function getGuardianProfile(guardianProfileId: string): Promise<GuardianProfileDetail | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, status')
    .eq('id', guardianProfileId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const [linksByGuardian, detailsByGuardian, invitation] = await Promise.all([
    fetchLinksForGuardians([guardianProfileId]),
    fetchDetailsForGuardians([guardianProfileId]),
    guardianInvitationService.getInvitationForGuardian(guardianProfileId),
  ]);
  const details = detailsByGuardian.get(guardianProfileId);

  return {
    guardianProfileId: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    phone: profile.phone,
    status: profile.status,
    links: linksByGuardian.get(guardianProfileId) ?? [],
    address: details?.address ?? null,
    idNumber: details?.idNumber ?? null,
    invitation,
  };
}

/** Creates a brand-new guardian not yet linked to any learner — reuses guardianService's admin_create_guardian wrapper, the single place that RPC is called from. */
async function createGuardian(input: CreateGuardianDirectoryInput): Promise<GuardianDirectoryEntry> {
  const created = await guardianService.createGuardianProfile(input);
  return {
    guardianProfileId: created.id,
    firstName: created.firstName,
    lastName: created.lastName,
    email: created.email,
    phone: created.phone,
    status: 'active',
    links: [],
    invitation: null,
  };
}

/** Upserts the guardian-only extension row (address/id_number) — may not exist yet if the guardian predates this table. */
async function updateGuardianDetails(
  schoolId: string,
  guardianProfileId: string,
  updates: UpdateGuardianDetailsInput,
): Promise<void> {
  const { error } = await supabase
    .from('guardian_profile_details')
    .upsert(
      { school_id: schoolId, guardian_profile_id: guardianProfileId, address: updates.address ?? null, id_number: updates.idNumber ?? null },
      { onConflict: 'guardian_profile_id' },
    );
  if (error) throw error;
}

export const guardianDirectoryService = {
  listGuardians,
  getGuardianProfile,
  createGuardian,
  updateGuardianDetails,
};
