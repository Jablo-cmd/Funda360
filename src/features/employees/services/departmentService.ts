import { supabase } from '@/lib/supabase';
import type { DepartmentRow, DepartmentInsert, DepartmentUpdate } from '@/lib/database.types';
import type { Department, CreateDepartmentInput, UpdateDepartmentInput } from '@/features/employees/types/employee.types';

/** Exported so employeeService can reuse it instead of re-declaring its own mapper. */
export function toDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    code: row.code,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDepartments(schoolId: string): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data.map(toDepartment);
}

async function getDepartment(id: string): Promise<Department | null> {
  const { data, error } = await supabase.from('departments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toDepartment(data) : null;
}

async function createDepartment(schoolId: string, input: CreateDepartmentInput): Promise<Department> {
  const payload: DepartmentInsert = {
    school_id: schoolId,
    name: input.name,
    code: input.code ?? null,
    description: input.description ?? null,
  };
  const { data, error } = await supabase.from('departments').insert(payload).select('*').single();
  if (error) throw error;
  return toDepartment(data);
}

async function updateDepartment(id: string, updates: UpdateDepartmentInput): Promise<Department> {
  const payload: DepartmentUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.code !== undefined) payload.code = updates.code;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase.from('departments').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toDepartment(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false. */
async function archiveDepartment(id: string): Promise<Department> {
  return updateDepartment(id, { active: false });
}

async function restoreDepartment(id: string): Promise<Department> {
  return updateDepartment(id, { active: true });
}

export const departmentService = {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  archiveDepartment,
  restoreDepartment,
};
