import { useEffect, useState } from 'react';
import { aiService } from '@/features/ai/services/aiService';
import type { AiFeature } from '@/features/ai/types/ai.types';
import { useAuth } from '@/features/auth/context/authContext';
import { useSchool } from '@/features/school/hooks/useSchool';

/** The Funda AI features the signed-in user can use (empty while loading, when off, or on error). */
export function useAiFeatures(): AiFeature[] {
  const { user } = useAuth();
  const { school } = useSchool();
  const userId = user?.id ?? null;
  const schoolId = school?.id ?? null;
  const [features, setFeatures] = useState<AiFeature[]>([]);

  useEffect(() => {
    if (!userId) {
      setFeatures([]);
      return;
    }
    let current = true;
    void aiService.listMyFeatures().then((list) => {
      if (current) setFeatures(list);
    });
    return () => {
      current = false;
    };
  }, [userId, schoolId]);

  return features;
}
