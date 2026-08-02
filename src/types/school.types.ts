/** Mirrors the `school_type` / `school_status` Postgres enums (see supabase/migrations). */
export type SchoolType = 'public' | 'private' | 'independent';

export type SchoolStatus = 'pending' | 'active' | 'inactive' | 'suspended';

/** A tenant root — one row per school/institution onboarded onto Funda360. */
export interface School {
  id: string;
  name: string;
  registrationNumber: string | null;
  educationDepartment: string | null;
  schoolType: SchoolType;
  province: string | null;
  district: string | null;
  emisNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  physicalAddress: string | null;
  postalAddress: string | null;
  principalName: string | null;
  timezone: string;
  currency: string;
  language: string;
  status: SchoolStatus;
  createdAt: string;
  updatedAt: string;
}
