import { supabase } from '@/lib/supabase';
import type { LearnerMedicalInformationRow, LearnerMedicalInformationInsert, LearnerMedicalInformationUpdate } from '@/lib/database.types';
import type { LearnerMedicalInformation, UpdateLearnerMedicalInformationInput } from '@/features/learners/types/learner.types';

export function toLearnerMedicalInformation(row: LearnerMedicalInformationRow): LearnerMedicalInformation {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    allergies: row.allergies,
    medication: row.medication,
    medicalConditions: row.medical_conditions,
    doctorName: row.doctor_name,
    doctorPhone: row.doctor_phone,
    medicalAidProvider: row.medical_aid_provider,
    medicalAidNumber: row.medical_aid_number,
    emergencyMedicalNotes: row.emergency_medical_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Returns null if the learner has no medical information record yet (1:1, not guaranteed to exist). */
async function getMedicalInformation(learnerId: string): Promise<LearnerMedicalInformation | null> {
  const { data, error } = await supabase.from('learner_medical_information').select('*').eq('learner_id', learnerId).maybeSingle();
  if (error) throw error;
  return data ? toLearnerMedicalInformation(data) : null;
}

function toPayload(updates: UpdateLearnerMedicalInformationInput): LearnerMedicalInformationUpdate {
  const payload: LearnerMedicalInformationUpdate = {};
  if (updates.allergies !== undefined) payload.allergies = updates.allergies;
  if (updates.medication !== undefined) payload.medication = updates.medication;
  if (updates.medicalConditions !== undefined) payload.medical_conditions = updates.medicalConditions;
  if (updates.doctorName !== undefined) payload.doctor_name = updates.doctorName;
  if (updates.doctorPhone !== undefined) payload.doctor_phone = updates.doctorPhone;
  if (updates.medicalAidProvider !== undefined) payload.medical_aid_provider = updates.medicalAidProvider;
  if (updates.medicalAidNumber !== undefined) payload.medical_aid_number = updates.medicalAidNumber;
  if (updates.emergencyMedicalNotes !== undefined) payload.emergency_medical_notes = updates.emergencyMedicalNotes;
  return payload;
}

async function createMedicalInformation(
  schoolId: string,
  learnerId: string,
  input: UpdateLearnerMedicalInformationInput,
): Promise<LearnerMedicalInformation> {
  const payload: LearnerMedicalInformationInsert = { school_id: schoolId, learner_id: learnerId, ...toPayload(input) };
  const { data, error } = await supabase.from('learner_medical_information').insert(payload).select('*').single();
  if (error) throw error;
  return toLearnerMedicalInformation(data);
}

async function updateMedicalInformation(id: string, updates: UpdateLearnerMedicalInformationInput): Promise<LearnerMedicalInformation> {
  const { data, error } = await supabase.from('learner_medical_information').update(toPayload(updates)).eq('id', id).select('*').single();
  if (error) throw error;
  return toLearnerMedicalInformation(data);
}

export const medicalInformationService = {
  getMedicalInformation,
  createMedicalInformation,
  updateMedicalInformation,
};
