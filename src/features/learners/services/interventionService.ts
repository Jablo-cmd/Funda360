import { supabase } from '@/lib/supabase';
import type { AcademicInterventionRow, AcademicInterventionInsert, AcademicInterventionUpdate } from '@/lib/database.types';
import type {
  AcademicIntervention,
  CreateAcademicInterventionInput,
  UpdateInterventionStatusInput,
} from '@/features/learners/types/intervention.types';

function toIntervention(row: AcademicInterventionRow): AcademicIntervention {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    subjectId: row.subject_id,
    title: row.title,
    description: row.description,
    status: row.status,
    targetDate: row.target_date,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getInterventions(learnerId: string): Promise<AcademicIntervention[]> {
  const { data, error } = await supabase
    .from('academic_interventions')
    .select('*')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toIntervention);
}

async function createIntervention(
  schoolId: string,
  learnerId: string,
  input: CreateAcademicInterventionInput,
): Promise<AcademicIntervention> {
  const payload: AcademicInterventionInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    subject_id: input.subjectId ?? null,
    title: input.title,
    description: input.description ?? null,
    target_date: input.targetDate ?? null,
  };
  const { data, error } = await supabase.from('academic_interventions').insert(payload).select('*').single();
  if (error) throw error;
  return toIntervention(data);
}

/** resolved_at is never sent here — the server (academic_interventions_sync_resolved_at()) always derives it from status, so a client value would be silently overwritten anyway. */
async function updateStatus(id: string, input: UpdateInterventionStatusInput): Promise<AcademicIntervention> {
  const payload: AcademicInterventionUpdate = {
    status: input.status,
    resolution_notes: input.resolutionNotes ?? null,
  };
  const { data, error } = await supabase.from('academic_interventions').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toIntervention(data);
}

export const interventionService = { getInterventions, createIntervention, updateStatus };
