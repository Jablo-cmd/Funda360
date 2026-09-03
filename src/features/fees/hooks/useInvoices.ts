import { useCallback, useEffect, useState } from 'react';
import { invoiceService } from '@/features/fees/services/invoiceService';
import type { InvoiceWithDetail } from '@/features/fees/types/invoice.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseInvoicesResult {
  invoices: InvoiceWithDetail[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Every invoice for one learner, newest first. Pass `learnerId` only when the caller holds learner.view_financial (RLS also enforces this). */
export function useLearnerInvoices(learnerId: string | undefined): UseInvoicesResult {
  const [invoices, setInvoices] = useState<InvoiceWithDetail[]>([]);
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
      setInvoices(await invoiceService.listInvoicesForLearner(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load invoices.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { invoices, isLoading, error, refetch: load };
}

/** Every invoice for a school in one academic year — the finance-office invoice register. */
export function useSchoolInvoices(schoolId: string | undefined, academicYearId: string | undefined): UseInvoicesResult {
  const [invoices, setInvoices] = useState<InvoiceWithDetail[]>([]);
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
      setInvoices(await invoiceService.listInvoicesForSchool(schoolId, academicYearId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load invoices.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { invoices, isLoading, error, refetch: load };
}
