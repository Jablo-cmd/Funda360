import { supabase } from '@/lib/supabase';

export interface MyGuardianProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  idNumber: string | null;
  /** False when no guardian_profile_details row exists yet (e.g. a guardian created before that table existed) — address/idNumber are then not editable until staff sets one up. */
  hasDetailsRecord: boolean;
}

export interface UpdateMyGuardianProfileInput {
  firstName: string;
  lastName: string;
  phone: string | null;
  /** Omit (or leave undefined) when hasDetailsRecord is false — see updateMyProfile. */
  address?: string | null;
  idNumber?: string | null;
}

/**
 * The guardian's own identity + guardian-only fields, self-scoped by
 * auth.uid() at the RLS layer (profiles_update_own — pre-existing, already
 * role-agnostic — and guardian_profile_details_select_own/update_own, new
 * in 20260825090000_parent_portal_v1.sql). A guardian may only ever read or
 * write their own row via these policies; there is no learnerId or
 * guardianProfileId parameter here because there is nothing to pass —
 * "my own profile" is exactly auth.uid(), not a value the client supplies.
 */
async function getMyProfile(): Promise<MyGuardianProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const { data: details, error: detailsError } = await supabase
    .from('guardian_profile_details')
    .select('address, id_number')
    .eq('guardian_profile_id', user.id)
    .maybeSingle();
  if (detailsError) throw detailsError;

  return {
    id: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    phone: profile.phone,
    address: details?.address ?? null,
    idNumber: details?.id_number ?? null,
    hasDetailsRecord: details !== null,
  };
}

async function updateMyProfile(input: UpdateMyGuardianProfileInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ first_name: input.firstName, last_name: input.lastName, phone: input.phone })
    .eq('id', user.id);
  if (profileError) throw profileError;

  // No guardian_profile_details_insert_own policy exists — that row is
  // created by staff (admin_create_guardian / Guardian Management), not
  // self-service. address/idNumber are only ever passed when
  // MyGuardianProfile.hasDetailsRecord was true, so this update always
  // targets a row that already exists.
  if (input.address !== undefined || input.idNumber !== undefined) {
    const { error: detailsError } = await supabase
      .from('guardian_profile_details')
      .update({ address: input.address, id_number: input.idNumber })
      .eq('guardian_profile_id', user.id);
    if (detailsError) throw detailsError;
  }
}

export const guardianSelfService = { getMyProfile, updateMyProfile };
