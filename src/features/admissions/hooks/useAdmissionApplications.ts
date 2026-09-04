import { useCallback, useEffect, useState } from 'react';
import { admissionService } from '@/features/admissions/services/admissionService';
import type { AdmissionApplication } from '@/features/admissions/types/admission.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAdmissionApplicationsResult {
  applications: AdmissionApplication[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAdmissionApplications(
  schoolId: string | undefined,
  filters: { status?: string; gradeId?: string; academicYearId?: string },
): UseAdmissionApplicationsResult {
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status, gradeId, academicYearId } = filters;

  const load = useCallback(async () => {
    if (!schoolId) {
      setApplications([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setApplications(await admissionService.listApplications(schoolId, { status, gradeId, academicYearId }));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load applications.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, status, gradeId, academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { applications, isLoading, error, refetch: load };
}
