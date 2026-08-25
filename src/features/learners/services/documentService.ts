import { supabase } from '@/lib/supabase';
import { storage, type FileValidationRule } from '@/lib/storage';
import type { LearnerDocumentRow, LearnerDocumentInsert } from '@/lib/database.types';
import type { LearnerDocument, CreateLearnerDocumentInput } from '@/features/learners/types/learner.types';

const BUCKET = 'learner-documents';

/** Mirrors the bucket's own server-side allowed_mime_types/file_size_limit (20260821100000_storage_buckets_and_documents.sql) — checked client-side first for immediate feedback, enforced again by the Storage API regardless. */
export const LEARNER_DOCUMENT_FILE_RULE: FileValidationRule = {
  maxSizeBytes: 15 * 1024 * 1024,
  allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
}

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

/**
 * Uploads the file to Storage first, then inserts the metadata row
 * pointing at it — the id is generated client-side so both the storage
 * path and the row's primary key are known upfront and stay in lockstep.
 * If the metadata insert fails after a successful upload (RLS rejection,
 * network error), the orphaned object is removed on a best-effort basis —
 * this is the only case in this codebase where a storage object is
 * deleted at all, and it's cleanup of a failed write, not a user action.
 */
async function createDocument(
  schoolId: string,
  learnerId: string,
  input: CreateLearnerDocumentInput,
): Promise<LearnerDocument> {
  const id = crypto.randomUUID();
  const path = `${schoolId}/${learnerId}/${id}-${sanitizeFileName(input.file.name)}`;

  await storage.uploadFile(BUCKET, path, input.file);

  const payload: LearnerDocumentInsert = {
    id,
    school_id: schoolId,
    learner_id: learnerId,
    document_type: input.documentType,
    file_url: path,
    file_name: input.file.name,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase.from('learner_documents').insert(payload).select('*').single();
  if (error) {
    await storage.removeFile(BUCKET, path).catch(() => undefined);
    throw error;
  }
  return toLearnerDocument(data);
}

/** Resolves a document's storage path to a short-lived signed URL — file_url is never directly fetchable. */
async function getSignedDownloadUrl(document: LearnerDocument): Promise<string> {
  return storage.getSignedUrl(BUCKET, document.fileUrl);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false. The underlying file is deliberately kept, not removed, matching that same never-hard-delete design. */
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
  getSignedDownloadUrl,
  archiveDocument,
  restoreDocument,
};
