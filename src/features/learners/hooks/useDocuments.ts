import { useCallback, useEffect, useState } from 'react';
import { documentService } from '@/features/learners/services/documentService';
import type { LearnerDocument } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseDocumentsResult {
  documents: LearnerDocument[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDocuments(learnerId: string | undefined): UseDocumentsResult {
  const [documents, setDocuments] = useState<LearnerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setDocuments(await documentService.getDocuments(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load documents.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { documents, isLoading, error, refetch: load };
}
