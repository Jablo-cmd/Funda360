import { supabase } from '@/lib/supabase';
import type { LearnerRow, LearnerInsert, LearnerUpdate, LearnerStatus } from '@/lib/database.types';
import type { Learner, CreateLearnerInput, UpdateLearnerInput, LearnersListFilters, LearnersListPage } from '@/features/learners/types/learner.types';

const DEFAULT_PAGE_SIZE = 20;

/** Exported so other learner services can reuse it instead of re-declaring their own mapper. */
export function toLearner(row: LearnerRow): Learner {
  return {
    id: row.id,
    schoolId: row.school_id,
    profileId: row.profile_id,
    learnerNumber: row.learner_number,
    admissionNumber: row.admission_number,
    firstName: row.first_name,
    lastName: row.last_name,
    preferredName: row.preferred_name,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    idNumber: row.id_number,
    passportNumber: row.passport_number,
    passportCountry: row.passport_country,
    nationality: row.nationality,
    homeLanguage: row.home_language,
    additionalLanguages: row.additional_languages,
    photoUrl: row.photo_url,
    transportMode: row.transport_mode,
    transportNotes: row.transport_notes,
    boardingType: row.boarding_type,
    status: row.status,
    statusReason: row.status_reason,
    admissionDate: row.admission_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Server-side pagination — reuses userService.getUsers's `.range()` pattern,
 * not Academic Structure's no-pagination approach. Learner directories are
 * the largest per-tenant dataset this platform models; unpaginated fetch
 * was explicitly rejected for this reason during architecture review.
 */
async function getLearners(
  schoolId: string,
  filters: LearnersListFilters = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<LearnersListPage> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('learners').select('*', { count: 'exact' }).eq('school_id', schoolId);

  const term = filters.search?.trim();
  if (term) {
    const escaped = term.replace(/[%,]/g, '');
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,learner_number.ilike.%${escaped}%,admission_number.ilike.%${escaped}%`,
    );
  }
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query.order('last_name', { ascending: true }).range(from, to);
  if (error) throw error;

  return {
    learners: data.map(toLearner),
    totalCount: count ?? 0,
    page,
    pageSize,
  };
}

async function getLearner(id: string): Promise<Learner | null> {
  const { data, error } = await supabase.from('learners').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toLearner(data) : null;
}

function toInsertPayload(schoolId: string, input: CreateLearnerInput): LearnerInsert {
  return {
    school_id: schoolId,
    learner_number: input.learnerNumber,
    admission_number: input.admissionNumber,
    first_name: input.firstName,
    last_name: input.lastName,
    preferred_name: input.preferredName ?? null,
    gender: input.gender ?? null,
    date_of_birth: input.dateOfBirth,
    id_number: input.idNumber ?? null,
    passport_number: input.passportNumber ?? null,
    passport_country: input.passportCountry ?? null,
    nationality: input.nationality ?? null,
    home_language: input.homeLanguage ?? null,
    additional_languages: input.additionalLanguages ?? null,
    photo_url: input.photoUrl ?? null,
    transport_mode: input.transportMode ?? null,
    transport_notes: input.transportNotes ?? null,
    boarding_type: input.boardingType ?? null,
    admission_date: input.admissionDate,
  };
}

async function createLearner(schoolId: string, input: CreateLearnerInput): Promise<Learner> {
  const { data, error } = await supabase.from('learners').insert(toInsertPayload(schoolId, input)).select('*').single();
  if (error) throw error;
  return toLearner(data);
}

async function updateLearner(id: string, updates: UpdateLearnerInput): Promise<Learner> {
  const payload: LearnerUpdate = {};
  if (updates.learnerNumber !== undefined) payload.learner_number = updates.learnerNumber;
  if (updates.admissionNumber !== undefined) payload.admission_number = updates.admissionNumber;
  if (updates.firstName !== undefined) payload.first_name = updates.firstName;
  if (updates.lastName !== undefined) payload.last_name = updates.lastName;
  if (updates.preferredName !== undefined) payload.preferred_name = updates.preferredName;
  if (updates.gender !== undefined) payload.gender = updates.gender;
  if (updates.dateOfBirth !== undefined) payload.date_of_birth = updates.dateOfBirth;
  if (updates.idNumber !== undefined) payload.id_number = updates.idNumber;
  if (updates.passportNumber !== undefined) payload.passport_number = updates.passportNumber;
  if (updates.passportCountry !== undefined) payload.passport_country = updates.passportCountry;
  if (updates.nationality !== undefined) payload.nationality = updates.nationality;
  if (updates.homeLanguage !== undefined) payload.home_language = updates.homeLanguage;
  if (updates.additionalLanguages !== undefined) payload.additional_languages = updates.additionalLanguages;
  if (updates.photoUrl !== undefined) payload.photo_url = updates.photoUrl;
  if (updates.transportMode !== undefined) payload.transport_mode = updates.transportMode;
  if (updates.transportNotes !== undefined) payload.transport_notes = updates.transportNotes;
  if (updates.boardingType !== undefined) payload.boarding_type = updates.boardingType;
  if (updates.admissionDate !== undefined) payload.admission_date = updates.admissionDate;

  const { data, error } = await supabase.from('learners').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toLearner(data);
}

/**
 * The only path that changes a learner's lifecycle status — calls the
 * SECURITY DEFINER change_learner_status() RPC, which validates the
 * transition server-side (see supabase/migrations) rather than trusting
 * the client to only ever request a valid transition.
 */
async function changeStatus(id: string, newStatus: LearnerStatus, reason: string | null = null): Promise<Learner> {
  const { data, error } = await supabase.rpc('change_learner_status', {
    p_learner_id: id,
    p_new_status: newStatus,
    p_reason: reason,
  });
  if (error) throw error;
  return toLearner(data);
}

export const learnerService = {
  getLearners,
  getLearner,
  createLearner,
  updateLearner,
  changeStatus,
};
