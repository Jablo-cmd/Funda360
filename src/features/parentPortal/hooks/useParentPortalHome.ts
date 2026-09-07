import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdmissionApplicationStatus } from '@/lib/database.types';
import { homeworkService } from '@/features/homework/services/homeworkService';
import type { Assignment, AssignmentSubmission } from '@/features/homework/types/homework.types';
import { isMissing } from '@/features/homework/utils/homeworkDisplay';

export interface MyApplication {
  id: string;
  referenceNumber: string | null;
  status: AdmissionApplicationStatus;
  learnerName: string;
  submittedAt: string | null;
}

export interface ParentPortalHome {
  applications: MyApplication[];
  homeworkDue: Array<{ assignment: Assignment; submission: AssignmentSubmission }>;
  homeworkMissingCount: number;
}

/**
 * Cross-domain roll-up for the Parent dashboard: outstanding homework
 * across all children + any admission applications the guardian filed
 * (get_my_admission_applications — matched by their own profile email).
 */
export function useParentPortalHome(learnerIds: string[]): {
  data: ParentPortalHome | null;
  isLoading: boolean;
} {
  const [data, setData] = useState<ParentPortalHome | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const key = learnerIds.slice().sort().join(',');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      supabase.rpc('get_my_admission_applications'),
      homeworkService.listAssignmentsForLearners(learnerIds),
    ])
      .then(([appsResult, homework]) => {
        if (cancelled) return;
        const applications: MyApplication[] = (appsResult.data ?? []).map((a) => ({
          id: a.id,
          referenceNumber: a.reference_number,
          status: a.status,
          learnerName: `${a.learner_first_name ?? ''} ${a.learner_last_name ?? ''}`.trim() || 'Applicant',
          submittedAt: a.submitted_at,
        }));
        const outstanding = homework.filter(
          ({ assignment, submission }) =>
            assignment.status === 'published' &&
            (submission.status === 'assigned' || submission.status === 'returned'),
        );
        const homeworkMissingCount = homework.filter(({ assignment, submission }) =>
          isMissing(submission, assignment.dueAt),
        ).length;
        setData({ applications, homeworkDue: outstanding.slice(0, 5), homeworkMissingCount });
      })
      .catch(() => {
        if (!cancelled) setData({ applications: [], homeworkDue: [], homeworkMissingCount: 0 });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, isLoading };
}
