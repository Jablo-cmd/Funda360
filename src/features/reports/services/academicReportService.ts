import { supabase } from '@/lib/supabase';
import { countActiveVsTotal } from '@/features/reports/utils/aggregation';
import type { AcademicReportSummary } from '@/features/reports/types/report.types';

async function getAcademicReport(schoolId: string): Promise<AcademicReportSummary> {
  const [yearsResult, gradesResult, classesResult, subjectsResult] = await Promise.all([
    supabase.from('academic_years').select('id, name, is_active').eq('school_id', schoolId),
    supabase.from('grades').select('active').eq('school_id', schoolId),
    supabase.from('classes').select('active').eq('school_id', schoolId),
    supabase.from('subjects').select('active').eq('school_id', schoolId),
  ]);
  if (yearsResult.error) throw yearsResult.error;
  if (gradesResult.error) throw gradesResult.error;
  if (classesResult.error) throw classesResult.error;
  if (subjectsResult.error) throw subjectsResult.error;

  const currentYear = yearsResult.data.find((year) => year.is_active) ?? null;

  const terms = currentYear
    ? await (async () => {
        const { data, error } = await supabase.from('terms').select('active').eq('academic_year_id', currentYear.id);
        if (error) throw error;
        return data;
      })()
    : [];

  return {
    currentAcademicYear: currentYear ? { id: currentYear.id, name: currentYear.name } : null,
    grades: countActiveVsTotal(gradesResult.data, (row) => row.active),
    classes: countActiveVsTotal(classesResult.data, (row) => row.active),
    subjects: countActiveVsTotal(subjectsResult.data, (row) => row.active),
    terms: countActiveVsTotal(terms, (row) => row.active),
  };
}

export const academicReportService = {
  getAcademicReport,
};
