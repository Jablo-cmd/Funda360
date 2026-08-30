import { useCallback, useEffect, useState } from 'react';
import { feeService } from '@/features/fees/services/feeService';
import type { FeeStructure } from '@/features/fees/types/feeStructure.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseFeeStructuresResult {
  feeStructures: FeeStructure[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** The school's fee-structure catalogue for one academic year — the template list FeeChargeFormModal and FeeStructuresPage both draw from. */
export function useFeeStructures(schoolId: string | undefined, academicYearId: string | undefined): UseFeeStructuresResult {
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId || !academicYearId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setFeeStructures(await feeService.getFeeStructures(schoolId, academicYearId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the fee structure catalogue.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { feeStructures, isLoading, error, refetch: load };
}
