import { supabase } from '@/lib/supabase';
import type { SchoolRow } from '@/lib/database.types';
import type { School } from '@/types/school.types';

/** Exported so schoolService (features/school) can reuse it instead of re-declaring its own mapper. */
export function toSchool(row: SchoolRow): School {
  return {
    id: row.id,
    name: row.name,
    registrationNumber: row.registration_number,
    educationDepartment: row.education_department,
    schoolType: row.school_type,
    province: row.province,
    district: row.district,
    emisNumber: row.emis_number,
    email: row.email,
    phone: row.phone,
    website: row.website,
    logoUrl: row.logo_url,
    physicalAddress: row.physical_address,
    postalAddress: row.postal_address,
    principalName: row.principal_name,
    timezone: row.timezone,
    currency: row.currency,
    language: row.language,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSchoolById(id: string): Promise<School | null> {
  const { data, error } = await supabase.from('schools').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toSchool(data) : null;
}

/**
 * Schools visible to the caller for tenant switching. RLS is the actual
 * gate here — a tenant-scoped user gets back only their own school, a
 * platform admin gets every school. The client never decides this itself.
 */
async function listAvailableSchools(): Promise<School[]> {
  const { data, error } = await supabase.from('schools').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data.map(toSchool);
}

export const tenantService = {
  getSchoolById,
  listAvailableSchools,
};
