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

import type { UserRole } from '@/features/auth/types/auth.types';

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
  physical_address: string | null;
  postal_address: string | null;
  principal_name: string | null;
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
  physical_address?: string | null;
  postal_address?: string | null;
  principal_name?: string | null;
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
  physical_address?: string | null;
  postal_address?: string | null;
  principal_name?: string | null;
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
  role: UserRole | null;
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
  role?: UserRole | null;
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
  role?: UserRole | null;
  status?: ProfileStatus;
  created_at?: string;
  updated_at?: string;
};

export type AcademicYearRow = {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademicYearInsert = {
  id?: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AcademicYearUpdate = {
  id?: string;
  school_id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TermRow = {
  id: string;
  academic_year_id: string;
  school_id: string;
  name: string;
  sequence: number;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TermInsert = {
  id?: string;
  academic_year_id: string;
  school_id: string;
  name: string;
  sequence: number;
  start_date: string;
  end_date: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TermUpdate = {
  id?: string;
  academic_year_id?: string;
  school_id?: string;
  name?: string;
  sequence?: number;
  start_date?: string;
  end_date?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type GradeRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type GradeInsert = {
  id?: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  sort_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type GradeUpdate = {
  id?: string;
  school_id?: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  sort_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ClassRow = {
  id: string;
  grade_id: string;
  school_id: string;
  name: string;
  capacity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClassInsert = {
  id?: string;
  grade_id: string;
  school_id: string;
  name: string;
  capacity: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ClassUpdate = {
  id?: string;
  grade_id?: string;
  school_id?: string;
  name?: string;
  capacity?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubjectInsert = {
  id?: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SubjectUpdate = {
  id?: string;
  school_id?: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
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
      academic_years: {
        Row: AcademicYearRow;
        Insert: AcademicYearInsert;
        Update: AcademicYearUpdate;
      };
      terms: {
        Row: TermRow;
        Insert: TermInsert;
        Update: TermUpdate;
      };
      grades: {
        Row: GradeRow;
        Insert: GradeInsert;
        Update: GradeUpdate;
      };
      classes: {
        Row: ClassRow;
        Insert: ClassInsert;
        Update: ClassUpdate;
      };
      subjects: {
        Row: SubjectRow;
        Insert: SubjectInsert;
        Update: SubjectUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_create_user: {
        Args: {
          p_email: string;
          p_first_name: string;
          p_last_name: string;
          p_phone: string | null;
          p_role: UserRole;
          p_tenant_id?: string | null;
        };
        Returns: { user_id: string; temporary_password: string }[];
      };
      admin_update_user_role: {
        Args: { p_user_id: string; p_new_role: UserRole };
        Returns: undefined;
      };
      set_active_academic_year: {
        Args: { p_academic_year_id: string };
        Returns: AcademicYearRow;
      };
    };
  };
};
