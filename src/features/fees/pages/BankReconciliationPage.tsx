import { useMemo, useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { useBankReconciliation } from '@/features/fees/hooks/useBankReconciliation';
import { BankStatementUploadModal } from '@/features/fees/components/BankStatementUploadModal';
import { bankReconciliationService } from '@/features/fees/services/bankReconciliationService';
import type { BankStatementLine } from '@/features/fees/types/bankReconciliation.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value);
}

const STATUS_STYLES: Record<BankStatementLine['status'], string> = {
  unmatched: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  matched: 'bg-success-500/10 text-success-500',
  ignored: 'bg-surface-sunken text-content-tertiary',
};

/**
 * FND-PAY-002. Shows every uploaded statement line across every upload
 * (not one statement at a time) alongside every currently unreconciled
 * payment, so a finance user can work through the backlog in one place.
 * Matching is never automatic — see the migration header
 * (20260829290000_bank_reconciliation.sql) for why amount+date alone
 * isn't trustworthy enough to commit without a human confirming which
 * specific payment a line corresponds to.
 */
export function BankReconciliationPage() {
  const { school } = useSchool();
  const { can } = usePermissions();
  const canManage = can('learner.manage_financial');
  const { lines, unreconciledPayments, matchedPaymentsById, learnerNames, isLoading, error, refetch } = useBankReconciliation(school?.id);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actioningLineId, setActioningLineId] = useState<string | null>(null);
  const [selectedPaymentByLine, setSelectedPaymentByLine] = useState<Record<string, string>>({});

  const paymentsById = useMemo(() => new Map(unreconciledPayments.map((p) => [p.id, p])), [unreconciledPayments]);

  const unmatchedLines = lines.filter((l) => l.status === 'unmatched');
  const matchedLines = lines.filter((l) => l.status === 'matched');
  const ignoredLines = lines.filter((l) => l.status === 'ignored');

  function candidatesFor(line: BankStatementLine) {
    const exact = unreconciledPayments.filter((p) => p.amount === line.amount);
    return exact.length > 0 ? exact : unreconciledPayments;
  }

  async function handleMatch(line: BankStatementLine) {
    const paymentId = selectedPaymentByLine[line.id];
    if (!paymentId) return;
    setActionError(null);
    setActioningLineId(line.id);
    try {
      await bankReconciliationService.reconcile(line.id, paymentId);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to match this line.'));
    } finally {
      setActioningLineId(null);
    }
  }

  async function handleUnmatch(line: BankStatementLine) {
    setActionError(null);
    setActioningLineId(line.id);
    try {
      await bankReconciliationService.unreconcile(line.id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to undo this match.'));
    } finally {
      setActioningLineId(null);
    }
  }

  async function handleIgnore(line: BankStatementLine) {
    setActionError(null);
    setActioningLineId(line.id);
    try {
      await bankReconciliationService.ignoreLine(line.id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to ignore this line.'));
    } finally {
      setActioningLineId(null);
    }
  }

  async function handleUnignore(line: BankStatementLine) {
    setActionError(null);
    setActioningLineId(line.id);
    try {
      await bankReconciliationService.unignoreLine(line.id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to restore this line.'));
    } finally {
      setActioningLineId(null);
    }
  }

  function paymentLabel(paymentId: string): string {
    const payment = paymentsById.get(paymentId);
    if (!payment) return 'Unknown payment';
    const learner = learnerNames[payment.learnerId];
    const name = learner ? `${learner.firstName} ${learner.lastName} (${learner.learnerNumber})` : payment.learnerId;
    return `${name} — ${formatAmount(payment.amount)} on ${formatDate(payment.paymentDate)}`;
  }

  function matchedPaymentLabel(paymentId: string): string {
    const payment = matchedPaymentsById[paymentId];
    if (!payment) return 'a payment';
    const learner = learnerNames[payment.learnerId];
    return learner ? `${learner.firstName} ${learner.lastName} (${learner.learnerNumber})` : 'a learner';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Bank Reconciliation"
        description="Match uploaded bank statement lines against existing recorded fee payments."
        action={
          canManage && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={() => setIsUploadOpen(true)}>
                Upload statement
              </Button>
            </div>
          )
        }
      />

      <ErrorAlert message={error ?? actionError} />

      {!school ? (
        <NoActiveSchoolNotice resource="bank reconciliation" />
      ) : isLoading ? (
        <p className="text-sm text-content-tertiary">Loading…</p>
      ) : lines.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised p-4 text-sm text-content-tertiary">
          No bank statements uploaded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2.5 text-sm font-semibold text-content-primary">Unmatched ({unmatchedLines.length})</h2>
            {unmatchedLines.length === 0 ? (
              <p className="text-sm text-content-tertiary">Nothing unmatched.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {unmatchedLines.map((line) => {
                  const candidates = candidatesFor(line);
                  return (
                    <li key={line.id} className="rounded-card border border-border bg-surface-raised p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[line.status]}`}>
                            Unmatched
                          </span>
                          <p className="mt-1.5 text-sm text-content-primary">{line.description}</p>
                          <p className="text-xs text-content-tertiary">
                            {formatDate(line.transactionDate)} · {formatAmount(line.amount)}
                          </p>
                        </div>
                        {canManage && (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={`Match payment for ${line.description}`}
                              className="focus-ring h-10 min-w-[16rem] rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
                              value={selectedPaymentByLine[line.id] ?? ''}
                              onChange={(e) => setSelectedPaymentByLine((prev) => ({ ...prev, [line.id]: e.target.value }))}
                            >
                              <option value="">Select a payment…</option>
                              {candidates.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {paymentLabel(p.id)}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              disabled={!selectedPaymentByLine[line.id]}
                              isLoading={actioningLineId === line.id}
                              onClick={() => void handleMatch(line)}
                            >
                              Match
                            </Button>
                            <Button type="button" variant="secondary" isLoading={actioningLineId === line.id} onClick={() => void handleIgnore(line)}>
                              Ignore
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2.5 text-sm font-semibold text-content-primary">Matched ({matchedLines.length})</h2>
            {matchedLines.length === 0 ? (
              <p className="text-sm text-content-tertiary">No matches yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {matchedLines.map((line) => (
                  <li key={line.id} className="rounded-card border border-border bg-surface-raised p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[line.status]}`}>
                          Matched
                        </span>
                        <p className="mt-1.5 text-sm text-content-primary">{line.description}</p>
                        <p className="text-xs text-content-tertiary">
                          {formatDate(line.transactionDate)} · {formatAmount(line.amount)}
                        </p>
                        {line.matchedPaymentId && (
                          <p className="mt-1 text-xs text-content-tertiary">Matched to {matchedPaymentLabel(line.matchedPaymentId)}</p>
                        )}
                      </div>
                      {canManage && (
                        <Button type="button" variant="secondary" isLoading={actioningLineId === line.id} onClick={() => void handleUnmatch(line)}>
                          Undo match
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2.5 text-sm font-semibold text-content-primary">Ignored ({ignoredLines.length})</h2>
            {ignoredLines.length === 0 ? (
              <p className="text-sm text-content-tertiary">Nothing ignored.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {ignoredLines.map((line) => (
                  <li key={line.id} className="rounded-card border border-border bg-surface-raised p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[line.status]}`}>
                          Ignored
                        </span>
                        <p className="mt-1.5 text-sm text-content-primary">{line.description}</p>
                        <p className="text-xs text-content-tertiary">
                          {formatDate(line.transactionDate)} · {formatAmount(line.amount)}
                        </p>
                      </div>
                      {canManage && (
                        <Button type="button" variant="secondary" isLoading={actioningLineId === line.id} onClick={() => void handleUnignore(line)}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {school && (
        <BankStatementUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          schoolId={school.id}
          onUploaded={() => {
            setIsUploadOpen(false);
            void refetch();
          }}
        />
      )}
    </PageContainer>
  );
}
