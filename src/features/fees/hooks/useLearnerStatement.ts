import { useCallback, useEffect, useState } from 'react';
import { invoiceService } from '@/features/fees/services/invoiceService';
import type { AccountStatement } from '@/features/fees/types/invoice.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseStatementResult {
  statement: AccountStatement | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** A learner's account statement as at today. */
export function useLearnerStatement(learnerId: string | undefined): UseStatementResult {
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setStatement(await invoiceService.getLearnerStatement(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the account statement.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { statement, isLoading, error, refetch: load };
}

/** A combined statement across a family (guardian's linked children). */
export function useFamilyStatement(learnerIds: string[]): UseStatementResult {
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = learnerIds.slice().sort().join(',');

  const load = useCallback(async () => {
    if (key.length === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setStatement(await invoiceService.getFamilyStatement(key.split(',')));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the family statement.'));
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return { statement, isLoading, error, refetch: load };
}
