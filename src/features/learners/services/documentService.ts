import { supabase } from '@/lib/supabase';
import type { LearnerDocumentRow, LearnerDocumentInsert } from '@/lib/database.types';
import type { LearnerDocument, CreateLearnerDocumentInput } from '@/features/learners/types/learner.types';

export function toLearnerDocument(row: LearnerDocumentRow): LearnerDocument {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    documentType: row.document_type,
    fileUrl: row.file_url,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDocuments(learnerId: string): Promise<LearnerDocument[]> {
  const { data, error } = await supabase
    .from('learner_documents')
    .select('*')
    .eq('learner_id', learnerId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data.map(toLearnerDocument);
}

async function createDocument(
  schoolId: string,
  learnerId: string,
  input: CreateLearnerDocumentInput,
): Promise<LearnerDocument> {
  const payload: LearnerDocumentInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    document_type: input.documentType,
    file_url: input.fileUrl,
    file_name: input.fileName ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase.from('learner_documents').insert(payload).select('*').single();
  if (error) throw error;
  return toLearnerDocument(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false. */
async function archiveDocument(id: string): Promise<LearnerDocument> {
  const { data, error } = await supabase.from('learner_documents').update({ active: false }).eq('id', id).select('*').single();
  if (error) throw error;
  return toLearnerDocument(data);
}

async function restoreDocument(id: string): Promise<LearnerDocument> {
  const { data, error } = await supabase.from('learner_documents').update({ active: true }).eq('id', id).select('*').single();
  if (error) throw error;
  return toLearnerDocument(data);
}

export const documentService = {
  getDocuments,
  createDocument,
  archiveDocument,
  restoreDocument,
};
