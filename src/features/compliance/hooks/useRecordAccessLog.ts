import { useEffect } from 'react';
import { logRecordAccess } from '@/features/compliance/services/complianceService';

/**
 * Writes a 'view' entry to the student-record access log whenever a learner
 * record (or a different section of it) is opened. The server de-duplicates
 * identical views within five minutes, so re-renders and refreshes do not
 * flood the log; a logging failure never blocks the page.
 */
export function useRecordAccessLog(learnerId: string | null | undefined, context: string): void {
  useEffect(() => {
    if (!learnerId) return;
    void logRecordAccess(learnerId, 'view', context);
  }, [learnerId, context]);
}
