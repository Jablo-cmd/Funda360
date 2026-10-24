import { supabase } from '@/lib/supabase';
import type { PlatformSupportGrantRow, PlatformSupportScope } from '@/lib/database.types';

/**
 * Support access (20261024090000). Platform users have no standing access to
 * a school's safeguarding, medical, behaviour or messages data; they request
 * it here and the school's owner or principal decides. RLS decides which
 * grants each caller can list: platform users see all, a school sees its own.
 */
export async function listSupportGrants(schoolId?: string): Promise<PlatformSupportGrantRow[]> {
  let query = supabase
    .from('platform_support_grants')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function requestSupportAccess(input: {
  schoolId: string;
  scopes: PlatformSupportScope[];
  reason: string;
  durationHours: number;
}): Promise<PlatformSupportGrantRow> {
  const { data, error } = await supabase.rpc('request_platform_support_access', {
    p_school_id: input.schoolId,
    p_scopes: input.scopes,
    p_reason: input.reason,
    p_duration_hours: input.durationHours,
  });
  if (error) throw error;
  return data;
}

export async function decideSupportAccess(
  grantId: string,
  approve: boolean,
  note?: string,
): Promise<PlatformSupportGrantRow> {
  const { data, error } = await supabase.rpc('decide_platform_support_access', {
    p_grant_id: grantId,
    p_approve: approve,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
  return data;
}

export async function revokeSupportAccess(grantId: string): Promise<PlatformSupportGrantRow> {
  const { data, error } = await supabase.rpc('revoke_platform_support_access', {
    p_grant_id: grantId,
  });
  if (error) throw error;
  return data;
}
