import { supabase } from '@/lib/supabase';
import type { BehaviourIncidentRow, BehaviourIncidentInsert } from '@/lib/database.types';
import type {
  BehaviourIncident,
  CreateBehaviourIncidentInput,
  LearnerBehaviourSummary,
} from '@/features/behaviour/types/behaviour.types';

/** Negative incidents within this many days count toward "attention required" — outside this window a resolved history no longer flags the learner as a current concern. */
const RECENT_WINDOW_DAYS = 90;

function toIncident(row: BehaviourIncidentRow): BehaviourIncident {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    incidentType: row.incident_type,
    severity: row.severity,
    category: row.category,
    occurredAt: row.occurred_at,
    description: row.description,
    actionTaken: row.action_taken,
    outcome: row.outcome,
    followUpRequired: row.follow_up_required,
    followUpNotes: row.follow_up_notes,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every active incident for a learner, most recent first. */
async function getIncidents(learnerId: string): Promise<BehaviourIncident[]> {
  const { data, error } = await supabase
    .from('behaviour_incidents')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('active', true)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return data.map(toIncident);
}

async function getLearnerBehaviourSummary(learnerId: string): Promise<LearnerBehaviourSummary> {
  const incidents = await getIncidents(learnerId);
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const hasRecentNegative = incidents.some(
    (incident) => incident.incidentType === 'negative' && new Date(incident.occurredAt).getTime() >= cutoff,
  );
  const positiveCount = incidents.filter((incident) => incident.incidentType === 'positive').length;
  const negativeCount = incidents.filter((incident) => incident.incidentType === 'negative').length;

  return { incidents, hasRecentNegative, positiveCount, negativeCount };
}

async function createIncident(
  schoolId: string,
  learnerId: string,
  input: CreateBehaviourIncidentInput,
): Promise<BehaviourIncident> {
  const payload: BehaviourIncidentInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    incident_type: input.incidentType,
    severity: input.severity || null,
    category: input.category || null,
    occurred_at: new Date(input.occurredAt).toISOString(),
    description: input.description,
    action_taken: input.actionTaken || null,
    outcome: input.outcome || null,
    follow_up_required: input.followUpRequired ?? false,
    follow_up_notes: input.followUpNotes || null,
  };
  const { data, error } = await supabase.from('behaviour_incidents').insert(payload).select('*').single();
  if (error) throw error;
  return toIncident(data);
}

/** Never hard-deleted (no DELETE RLS policy) — an incident entered in error is excluded via active: false. */
async function voidIncident(id: string): Promise<BehaviourIncident> {
  const { data, error } = await supabase
    .from('behaviour_incidents')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toIncident(data);
}

export const behaviourService = {
  getIncidents,
  getLearnerBehaviourSummary,
  createIncident,
  voidIncident,
};
