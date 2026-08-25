import { supabase } from '@/lib/supabase';
import { storage, type FileValidationRule } from '@/lib/storage';
import { tenantService, toSchool } from '@/features/tenant/services/tenantService';
import { profileService } from '@/features/profile/services/profileService';
import type { SchoolUpdate } from '@/lib/database.types';
import type { School } from '@/types/school.types';
import type {
  SchoolProfileUpdateInput,
  SchoolSettingsUpdateInput,
} from '@/features/school/types/school.types';

const LOGO_BUCKET = 'school-logos';

/** Mirrors the bucket's own server-side allowed_mime_types/file_size_limit (20260821100000_storage_buckets_and_documents.sql). */
export const SCHOOL_LOGO_FILE_RULE: FileValidationRule = {
  maxSizeBytes: 2 * 1024 * 1024,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
};

function logoPath(schoolId: string): string {
  return `${schoolId}/logo`;
}

/** Delegates to tenantService — schoolService doesn't own school *reads*, only re-exposes them plus writes. */
async function getSchoolById(id: string): Promise<School | null> {
  return tenantService.getSchoolById(id);
}

/**
 * One-shot "current user's school" lookup with no React context required —
 * useful outside components. Inside the app, prefer useSchool()/useTenant(),
 * which reuse state already loaded by TenantProvider instead of re-fetching.
 */
async function getCurrentSchool(): Promise<School | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const profile = await profileService.getProfileById(session.user.id);
  if (!profile?.tenantId) return null;

  return getSchoolById(profile.tenantId);
}

function toProfileUpdatePayload(updates: SchoolProfileUpdateInput): SchoolUpdate {
  const payload: SchoolUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.registrationNumber !== undefined) payload.registration_number = updates.registrationNumber;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.website !== undefined) payload.website = updates.website;
  if (updates.physicalAddress !== undefined) payload.physical_address = updates.physicalAddress;
  if (updates.postalAddress !== undefined) payload.postal_address = updates.postalAddress;
  if (updates.principalName !== undefined) payload.principal_name = updates.principalName;
  return payload;
}

function toSettingsUpdatePayload(updates: SchoolSettingsUpdateInput): SchoolUpdate {
  const payload: SchoolUpdate = {};
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
  if (updates.currency !== undefined) payload.currency = updates.currency;
  if (updates.language !== undefined) payload.language = updates.language;
  return payload;
}

async function applyUpdate(id: string, payload: SchoolUpdate): Promise<School> {
  const { data, error } = await supabase.from('schools').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toSchool(data);
}

/** Updates the School Profile page's editable fields. Rejected by RLS unless the caller has `school.manage`. */
async function updateSchool(id: string, updates: SchoolProfileUpdateInput): Promise<School> {
  return applyUpdate(id, toProfileUpdatePayload(updates));
}

/** Updates regional/config settings (timezone, currency, language). Same RLS gate as updateSchool. */
async function updateSchoolSettings(id: string, updates: SchoolSettingsUpdateInput): Promise<School> {
  return applyUpdate(id, toSettingsUpdatePayload(updates));
}

/**
 * Uploads (or replaces) the school's logo at a fixed path — upsert:true
 * means a re-upload overwrites the same object in place, so there is
 * never an orphaned previous logo to clean up. Uploads first, then
 * updates logo_url to that fixed path (a no-op after the first upload,
 * since the path never changes — kept explicit so the column stays NULL,
 * and the UI can tell "no logo yet" apart from "logo exists", until the
 * first successful upload).
 */
async function uploadLogo(id: string, file: File): Promise<School> {
  const path = logoPath(id);
  await storage.uploadFile(LOGO_BUCKET, path, file);
  return applyUpdate(id, { logo_url: path });
}

/** Resolves the school's logo path to a short-lived signed URL — logo_url is never directly fetchable. Returns null if no logo has been uploaded. */
async function getLogoSignedUrl(school: School): Promise<string | null> {
  if (!school.logoUrl) return null;
  return storage.getSignedUrl(LOGO_BUCKET, school.logoUrl);
}

export const schoolService = {
  getSchoolById,
  getCurrentSchool,
  updateSchool,
  updateSchoolSettings,
  uploadLogo,
  getLogoSignedUrl,
};
