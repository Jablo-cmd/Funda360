import { useCallback, useEffect, useState } from 'react';
import { admissionService } from '@/features/admissions/services/admissionService';
import type { AdmissionApplicationWithDetail } from '@/features/admissions/types/admission.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAdmissionApplicationResult {
  application: AdmissionApplicationWithDetail | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => Promise<void>;
}

export function useAdmissionApplication(id: string | undefined): UseAdmissionApplicationResult {
  const [application, setApplication] = useState<AdmissionApplicationWithDetail | null>(null);
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
      const result = await admissionService.getApplication(id);
      if (!result) setNotFound(true);
      setApplication(result);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load this application.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { application, isLoading, error, notFound, refetch: load };
}
