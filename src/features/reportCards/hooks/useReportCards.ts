import { useCallback, useEffect, useState } from 'react';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import type { ReportCard } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface ReportCardFilters {
  classId?: string;
  termId?: string;
  learnerId?: string;
  status?: string;
}

export interface UseReportCardsResult {
  cards: ReportCard[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** The administrative report-card list. Pass a school id and any filters. */
export function useReportCards(schoolId: string | undefined, filters: ReportCardFilters): UseReportCardsResult {
  const [cards, setCards] = useState<ReportCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { classId, termId, learnerId, status } = filters;

  const load = useCallback(async () => {
    if (!schoolId) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setCards(await reportCardService.listCards(schoolId, { classId, termId, learnerId, status }));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load report cards.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, classId, termId, learnerId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return { cards, isLoading, error, refetch: load };
}
