/**
 * Domain types for the Academic Structure feature. Used only within this
 * feature, so per the type-ownership convention (handbook §20) these stay
 * here rather than in the cross-feature src/types/ barrel.
 */

export interface AcademicYear {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Term {
  id: string;
  academicYearId: string;
  schoolId: string;
  name: string;
  sequence: number;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Grade {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  gradeId: string;
  schoolId: string;
  name: string;
  capacity: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface UpdateAcademicYearInput {
  name?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateTermInput {
  academicYearId: string;
  name: string;
  sequence: number;
  startDate: string;
  endDate: string;
}

export interface UpdateTermInput {
  name?: string;
  sequence?: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
}

export interface CreateGradeInput {
  name: string;
  code?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateGradeInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface CreateClassInput {
  gradeId: string;
  name: string;
  capacity: number;
}

export interface UpdateClassInput {
  gradeId?: string;
  name?: string;
  capacity?: number;
  active?: boolean;
}

export interface CreateSubjectInput {
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface UpdateSubjectInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
}
