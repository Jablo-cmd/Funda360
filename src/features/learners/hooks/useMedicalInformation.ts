import { useCallback, useEffect, useState } from 'react';
import { medicalInformationService } from '@/features/learners/services/medicalInformationService';
import type { LearnerMedicalInformation } from '@/features/learners/types/learner.types';

export interface UseMedicalInformationResult {
  medicalInformation: LearnerMedicalInformation | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMedicalInformation(learnerId: string | undefined): UseMedicalInformationResult {
  const [medicalInformation, setMedicalInformation] = useState<LearnerMedicalInformation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setMedicalInformation(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setMedicalInformation(await medicalInformationService.getMedicalInformation(learnerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load medical information.');
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { medicalInformation, isLoading, error, refetch: load };
}
