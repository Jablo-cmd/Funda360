import { useCallback, useEffect, useState } from 'react';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import type { ReportCardTemplate } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseReportCardTemplatesResult {
  templates: ReportCardTemplate[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useReportCardTemplates(schoolId: string | undefined): UseReportCardTemplatesResult {
  const [templates, setTemplates] = useState<ReportCardTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setTemplates(await reportCardService.listTemplates(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load report-card templates.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { templates, isLoading, error, refetch: load };
}
