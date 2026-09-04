import { useCallback, useEffect, useState } from 'react';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import type { ReportCard } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseLearnerReportCardsResult {
  cards: ReportCard[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * A learner's report cards. Staff see every status; a guardian (via RLS)
 * sees only published ones — this hook does not branch, it just renders
 * whatever the caller is permitted to read.
 */
export function useLearnerReportCards(learnerId: string | undefined): UseLearnerReportCardsResult {
  const [cards, setCards] = useState<ReportCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setCards(await reportCardService.listCardsForLearner(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load report cards.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { cards, isLoading, error, refetch: load };
}
