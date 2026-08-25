import { useCallback, useEffect, useState } from 'react';
import { timetableService } from '@/features/timetable/services/timetableService';
import type { TimetableEntry } from '@/features/timetable/types/timetable.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseTimetableEntriesResult {
  entries: TimetableEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTimetableEntries(schoolId: string | undefined, academicYearId: string | undefined): UseTimetableEntriesResult {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId || !academicYearId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setEntries(await timetableService.getEntries(schoolId, academicYearId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the timetable.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { entries, isLoading, error, refetch: load };
}
