import { useCallback, useEffect, useState } from 'react';
import { admissionService } from '@/features/admissions/services/admissionService';
import type { AdmissionDocumentRequirement } from '@/features/admissions/types/admission.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAdmissionRequirementsResult {
  requirements: AdmissionDocumentRequirement[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAdmissionRequirements(schoolId: string | undefined): UseAdmissionRequirementsResult {
  const [requirements, setRequirements] = useState<AdmissionDocumentRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setRequirements([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setRequirements(await admissionService.listRequirements(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load document requirements.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { requirements, isLoading, error, refetch: load };
}
