/**
 * Thin wrapper around Supabase Storage, mirroring the shape every
 * `*Service.ts` in `src/features/*` already uses (plain async functions
 * grouped in an exported object). Every bucket this app uses is private —
 * callers always go through `getSignedUrl`, never a public object URL — so
 * access control lives entirely in the bucket's storage.objects RLS
 * policies (see the `storage_buckets_and_documents` migration), the same
 * place every other table's access control lives.
 */
import { supabase } from '@/lib/supabase';

export interface FileValidationRule {
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
}

export function validateFile(file: File, rule: FileValidationRule): string | null {
  if (!rule.allowedMimeTypes.includes(file.type)) {
    return `That file type isn't supported. Allowed types: ${rule.allowedMimeTypes.map((t) => t.split('/')[1]).join(', ')}.`;
  }
  if (file.size > rule.maxSizeBytes) {
    return `That file is too large — the limit is ${Math.round(rule.maxSizeBytes / (1024 * 1024))}MB.`;
  }
  return null;
}

async function uploadFile(bucket: string, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
}

async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

async function removeFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export const storage = {
  validateFile,
  uploadFile,
  getSignedUrl,
  removeFile,
};
