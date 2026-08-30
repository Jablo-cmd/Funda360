import { supabase } from '@/lib/supabase';

export interface GlobalSearchResult {
  type: 'learner' | 'employee' | 'guardian';
  id: string;
  label: string;
  sublabel: string;
  path: string;
}

const RESULTS_PER_DOMAIN = 5;

function escapeSearchTerm(term: string): string {
  return term.replace(/[%,]/g, '');
}

async function searchLearners(schoolId: string, term: string): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('learners')
    .select('id, first_name, last_name, learner_number, admission_number')
    .eq('school_id', schoolId)
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,learner_number.ilike.%${term}%,admission_number.ilike.%${term}%`)
    .order('last_name', { ascending: true })
    .limit(RESULTS_PER_DOMAIN);
  if (error) throw error;
  return data.map((row) => ({
    type: 'learner' as const,
    id: row.id,
    label: `${row.first_name} ${row.last_name}`,
    sublabel: `${row.learner_number} · ${row.admission_number}`,
    path: `/learners/${row.id}`,
  }));
}

async function searchEmployees(schoolId: string, term: string): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_number, job_title')
    .eq('school_id', schoolId)
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_number.ilike.%${term}%,job_title.ilike.%${term}%`)
    .order('last_name', { ascending: true })
    .limit(RESULTS_PER_DOMAIN);
  if (error) throw error;
  return data.map((row) => ({
    type: 'employee' as const,
    id: row.id,
    label: `${row.first_name} ${row.last_name}`,
    sublabel: [row.employee_number, row.job_title].filter(Boolean).join(' · '),
    path: `/employees/${row.id}`,
  }));
}

/** Guardians are `profiles` rows (role in ('parent','guardian')), not a dedicated table — same query shape as guardianDirectoryService.listGuardians. */
async function searchGuardians(schoolId: string, term: string): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', schoolId)
    .in('role', ['parent', 'guardian'])
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
    .order('last_name', { ascending: true })
    .limit(RESULTS_PER_DOMAIN);
  if (error) throw error;
  return data.map((row) => ({
    type: 'guardian' as const,
    id: row.id,
    label: `${row.first_name} ${row.last_name}`,
    sublabel: row.email ?? '',
    path: `/guardians/${row.id}`,
  }));
}

/**
 * Powers the Cmd/Ctrl+K command palette (FND-ARCH-005) — three independent,
 * capped queries run in parallel, one per domain the caller is actually
 * permitted to view (RLS enforces this regardless; the `enabled` flags are
 * purely to avoid firing a query nobody could see results from). Each
 * domain is capped at 5 results — this is a "jump to a specific record"
 * tool, not a full search-results page; a query broad enough to matter
 * beyond 5 hits per domain belongs on the dedicated Learners/Employees/
 * Guardians directory pages instead, which already have real pagination.
 */
async function search(
  schoolId: string,
  term: string,
  enabled: { learners: boolean; employees: boolean; guardians: boolean },
): Promise<GlobalSearchResult[]> {
  const trimmed = escapeSearchTerm(term.trim());
  if (trimmed.length === 0) return [];

  const [learners, employees, guardians] = await Promise.all([
    enabled.learners ? searchLearners(schoolId, trimmed) : Promise.resolve([]),
    enabled.employees ? searchEmployees(schoolId, trimmed) : Promise.resolve([]),
    enabled.guardians ? searchGuardians(schoolId, trimmed) : Promise.resolve([]),
  ]);

  return [...learners, ...employees, ...guardians];
}

export const globalSearchService = { search };
