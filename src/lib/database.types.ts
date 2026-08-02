/**
 * Hand-written mirror of supabase/migrations, in the same Row/Insert/Update
 * shape the Supabase CLI's `gen types typescript` produces — a real
 * generated file can drop in later with no changes needed at call sites
 * (`createClient<Database>`, `supabase.from(...)`).
 *
 * Deliberately `type`, not `interface`, throughout (matching what codegen
 * emits): postgrest-js's generic inference for `.update()`/`.insert()`
 * fails to resolve (silently widening query results to `any`, verified
 * with an isolated repro) when Row/Insert/Update are declared as
 * `interface` instead of a plain object `type`.
 */

export type SchoolType = 'public' | 'private' | 'independent';
export type SchoolStatus = 'pending' | 'active' | 'inactive' | 'suspended';
export type ProfileStatus = 'active' | 'inactive' | 'suspended';

export type SchoolRow = {
  id: string;
  name: string;
  registration_number: string | null;
  education_department: string | null;
  school_type: SchoolType;
  province: string | null;
  district: string | null;
  emis_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  language: string;
  status: SchoolStatus;
  created_at: string;
  updated_at: string;
};

export type SchoolInsert = {
  id?: string;
  name: string;
  registration_number?: string | null;
  education_department?: string | null;
  school_type?: SchoolType;
  province?: string | null;
  district?: string | null;
  emis_number?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  address?: string | null;
  timezone?: string;
  currency?: string;
  language?: string;
  status?: SchoolStatus;
  created_at?: string;
  updated_at?: string;
};

export type SchoolUpdate = {
  id?: string;
  name?: string;
  registration_number?: string | null;
  education_department?: string | null;
  school_type?: SchoolType;
  province?: string | null;
  district?: string | null;
  emis_number?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  address?: string | null;
  timezone?: string;
  currency?: string;
  language?: string;
  status?: SchoolStatus;
  created_at?: string;
  updated_at?: string;
};

export type ProfileRow = {
  id: string;
  tenant_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  tenant_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  status?: ProfileStatus;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  id?: string;
  tenant_id?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  avatar_url?: string | null;
  status?: ProfileStatus;
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow;
        Insert: SchoolInsert;
        Update: SchoolUpdate;
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
