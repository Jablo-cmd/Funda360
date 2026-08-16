import { useCallback, useEffect, useState } from 'react';
import { emergencyContactService } from '@/features/learners/services/emergencyContactService';
import type { LearnerEmergencyContact } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseEmergencyContactsResult {
  emergencyContacts: LearnerEmergencyContact[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmergencyContacts(learnerId: string | undefined): UseEmergencyContactsResult {
  const [emergencyContacts, setEmergencyContacts] = useState<LearnerEmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setEmergencyContacts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setEmergencyContacts(await emergencyContactService.getEmergencyContacts(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load emergency contacts.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { emergencyContacts, isLoading, error, refetch: load };
}
