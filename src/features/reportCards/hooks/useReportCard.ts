import { useCallback, useEffect, useState } from 'react';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import type { ReportCardWithSubjects } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseReportCardResult {
  card: ReportCardWithSubjects | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => Promise<void>;
}

export function useReportCard(id: string | undefined): UseReportCardResult {
  const [card, setCard] = useState<ReportCardWithSubjects | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await reportCardService.getCard(id);
      if (!result) {
        setNotFound(true);
        setCard(null);
      } else {
        setCard(result);
      }
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load this report card.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { card, isLoading, error, notFound, refetch: load };
}
