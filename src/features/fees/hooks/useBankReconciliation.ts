import { useCallback, useEffect, useState } from 'react';
import { bankReconciliationService } from '@/features/fees/services/bankReconciliationService';
import type { UnreconciledPayment } from '@/features/fees/services/bankReconciliationService';
import type { BankStatementLine } from '@/features/fees/types/bankReconciliation.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseBankReconciliationResult {
  lines: BankStatementLine[];
  unreconciledPayments: UnreconciledPayment[];
  /** Already-matched payments, keyed by id — for rendering "matched to X" on a matched line (matched payments are, by definition, excluded from unreconciledPayments). */
  matchedPaymentsById: Record<string, UnreconciledPayment>;
  learnerNames: Record<string, { firstName: string; lastName: string; learnerNumber: string }>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBankReconciliation(schoolId: string | undefined): UseBankReconciliationResult {
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [unreconciledPayments, setUnreconciledPayments] = useState<UnreconciledPayment[]>([]);
  const [matchedPaymentsById, setMatchedPaymentsById] = useState<Record<string, UnreconciledPayment>>({});
  const [learnerNames, setLearnerNames] = useState<Record<string, { firstName: string; lastName: string; learnerNumber: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setLines([]);
      setUnreconciledPayments([]);
      setMatchedPaymentsById({});
      setLearnerNames({});
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [lineRows, paymentRows] = await Promise.all([
        bankReconciliationService.getLines(schoolId),
        bankReconciliationService.getUnreconciledPayments(schoolId),
      ]);
      setLines(lineRows);
      setUnreconciledPayments(paymentRows);

      const matchedIds = lineRows.map((l) => l.matchedPaymentId).filter((id): id is string => id !== null);
      const matchedPayments = await bankReconciliationService.getPaymentsByIds(matchedIds);
      setMatchedPaymentsById(Object.fromEntries(matchedPayments.map((p) => [p.id, p])));

      const allLearnerIds = [...paymentRows.map((p) => p.learnerId), ...matchedPayments.map((p) => p.learnerId)];
      setLearnerNames(await bankReconciliationService.getLearnerNamesByIds(allLearnerIds));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load bank reconciliation data.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { lines, unreconciledPayments, matchedPaymentsById, learnerNames, isLoading, error, refetch: load };
}
