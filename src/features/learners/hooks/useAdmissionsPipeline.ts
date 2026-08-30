import { useCallback, useEffect, useState } from 'react';
import { learnerService } from '@/features/learners/services/learnerService';
import { ADMISSIONS_PIPELINE_STAGES } from '@/features/learners/constants/learnerStatusLabels';
import type { Learner, LearnerStatus } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAdmissionsPipelineResult {
  columns: Record<LearnerStatus, Learner[]>;
  isLoading: boolean;
  error: string | null;
  /** Optimistically moves a learner to its new column, then reconciles with the server; rolls the board back to its last-known-good state if the RPC rejects the change (e.g. a permission or concurrent-edit error). */
  moveLearner: (learner: Learner, newStatus: LearnerStatus, reason?: string | null) => Promise<void>;
  refetch: () => Promise<void>;
}

function groupByStage(learners: Learner[]): Record<LearnerStatus, Learner[]> {
  const columns = Object.fromEntries(ADMISSIONS_PIPELINE_STAGES.map((stage) => [stage, [] as Learner[]])) as Record<
    LearnerStatus,
    Learner[]
  >;
  for (const learner of learners) {
    columns[learner.status]?.push(learner);
  }
  return columns;
}

export function useAdmissionsPipeline(schoolId: string | undefined): UseAdmissionsPipelineResult {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await learnerService.getLearnersByStatuses(schoolId, ADMISSIONS_PIPELINE_STAGES);
      setLearners(result);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the admissions pipeline.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveLearner = useCallback(
    async (learner: Learner, newStatus: LearnerStatus, reason: string | null = null) => {
      const previous = learners;
      // Optimistic update: a learner leaving the pipeline entirely (e.g.
      // withdrawn) simply disappears from the board rather than being
      // reflected in a fifth column — this board only ever shows the four
      // in-flight stages.
      setLearners((current) =>
        current.map((item) => (item.id === learner.id ? { ...item, status: newStatus } : item)),
      );
      try {
        await learnerService.changeStatus(learner.id, newStatus, reason);
      } catch (err) {
        setLearners(previous);
        throw err;
      }
    },
    [learners],
  );

  return { columns: groupByStage(learners), isLoading, error, moveLearner, refetch: load };
}
