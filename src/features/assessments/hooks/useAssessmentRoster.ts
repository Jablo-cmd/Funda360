import { useCallback, useEffect, useState } from 'react';
import { assessmentService } from '@/features/assessments/services/assessmentService';
import type { AssessmentResult, RosterLearner } from '@/features/assessments/types/assessment.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAssessmentRosterResult {
  roster: RosterLearner[];
  results: AssessmentResult[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** The class roster for an assessment plus whatever results are already recorded — powers mark entry and the class results view. */
export function useAssessmentRoster(
  classId: string | undefined,
  academicYearId: string | undefined,
  assessmentId: string | undefined,
): UseAssessmentRosterResult {
  const [roster, setRoster] = useState<RosterLearner[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId || !academicYearId || !assessmentId) {
      setRoster([]);
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [rosterResult, resultsResult] = await Promise.all([
        assessmentService.getClassRoster(classId, academicYearId),
        assessmentService.getResultsForAssessment(assessmentId),
      ]);
      setRoster(rosterResult);
      setResults(resultsResult);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the class roster.'));
    } finally {
      setIsLoading(false);
    }
  }, [classId, academicYearId, assessmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { roster, results, isLoading, error, refetch: load };
}
