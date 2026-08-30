import { supabase } from '@/lib/supabase';
import type { SafeguardingConcernRow, SafeguardingConcernInsert, SafeguardingConcernUpdate } from '@/lib/database.types';
import type {
  SafeguardingConcern,
  CreateSafeguardingConcernInput,
  UpdateSafeguardingConcernInput,
} from '@/features/safeguarding/types/safeguarding.types';

function toSafeguardingConcern(row: SafeguardingConcernRow): SafeguardingConcern {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    category: row.category,
    description: row.description,
    severity: row.severity,
    status: row.status,
    actionTaken: row.action_taken,
    confidentialNotes: row.confidential_notes,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every safeguarding concern for one learner — RLS (can_view_safeguarding, school_owner/principal only) is the actual access boundary, not this query. */
async function getConcernsForLearner(learnerId: string): Promise<SafeguardingConcern[]> {
  const { data, error } = await supabase
    .from('safeguarding_concerns')
    .select('*')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toSafeguardingConcern);
}

/** Every open/under_review/escalated concern for the school — the school-wide case list, for a dedicated safeguarding overview rather than having to open every learner's profile individually. */
async function getActiveConcerns(schoolId: string): Promise<SafeguardingConcern[]> {
  const { data, error } = await supabase
    .from('safeguarding_concerns')
    .select('*')
    .eq('school_id', schoolId)
    .in('status', ['open', 'under_review', 'escalated'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toSafeguardingConcern);
}

async function createConcern(schoolId: string, learnerId: string, input: CreateSafeguardingConcernInput): Promise<SafeguardingConcern> {
  const payload: SafeguardingConcernInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    category: input.category ?? null,
    description: input.description,
    severity: input.severity,
  };
  const { data, error } = await supabase.from('safeguarding_concerns').insert(payload).select('*').single();
  if (error) throw error;
  return toSafeguardingConcern(data);
}

/** resolved_at is never sent here — the server always derives it from status (safeguarding_concerns_sync_resolved_at()). */
async function updateConcern(id: string, input: UpdateSafeguardingConcernInput): Promise<SafeguardingConcern> {
  const payload: SafeguardingConcernUpdate = {
    status: input.status,
    action_taken: input.actionTaken,
    confidential_notes: input.confidentialNotes,
  };
  const { data, error } = await supabase.from('safeguarding_concerns').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toSafeguardingConcern(data);
}

export const safeguardingService = { getConcernsForLearner, getActiveConcerns, createConcern, updateConcern };
