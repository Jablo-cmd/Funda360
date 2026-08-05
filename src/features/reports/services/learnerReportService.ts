import { supabase } from '@/lib/supabase';
import type { LearnerStatus } from '@/features/learners/types/learner.types';
import { countBy } from '@/features/reports/utils/aggregation';
import type { LearnerReportSummary, LearnerStatusCount } from '@/features/reports/types/report.types';

async function getLearnerReport(schoolId: string): Promise<LearnerReportSummary> {
  const { data, error } = await supabase.from('learners').select('status').eq('school_id', schoolId);
  if (error) throw error;

  const counts = countBy(data, (row) => row.status);
  const byStatus: LearnerStatusCount[] = (Object.entries(counts) as [LearnerStatus, number][]).map(
    ([status, count]) => ({ status, count }),
  );

  return {
    totalLearners: data.length,
    byStatus,
  };
}

export const learnerReportService = {
  getLearnerReport,
};
