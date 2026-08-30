import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { SummaryCard } from '@/features/reports/components/SummaryCard';
import { SummaryBar } from '@/features/reports/components/SummaryBar';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { usePermissions } from '@/hooks/usePermissions';
import { feeService, type SchoolFinanceOverview, type LearnerFinanceBalanceRow } from '@/features/fees/services/feeService';
import { calculateCollectionRate } from '@/features/fees/utils/calculations';
import { getDbErrorMessage } from '@/lib/dbErrors';

const STATUS_LABELS: Record<LearnerFinanceBalanceRow['status'], string> = {
  paid: 'Paid',
  partially_paid: 'Partially Paid',
  outstanding: 'Outstanding',
  overdue: 'Overdue',
};

const DEBTOR_LIST_COLUMNS = [
  { key: 'learnerNumber' as const, header: 'Learner #' },
  { key: 'learnerName' as const, header: 'Name' },
  { key: 'status' as const, header: 'Status' },
  { key: 'totalCharged' as const, header: 'Total Charged' },
  { key: 'netPaid' as const, header: 'Net Paid' },
  { key: 'outstandingBalance' as const, header: 'Outstanding' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

/**
 * School-wide finance position — collection rate, outstanding/overdue
 * balance, status mix, and an ageing breakdown. Pulls the same raw
 * charge/payment/adjustment/refund rows the per-learner Fees tab uses (via
 * feeService.getSchoolFinanceOverview), so the two views can never
 * disagree — there is no separately-stored aggregate to drift out of sync.
 */
export function FinanceOverviewPage() {
  const { school } = useSchool();
  const { currentAcademicYear } = useAcademic();
  const { can } = usePermissions();
  const canManageFinancial = can('learner.manage_financial');
  const [overview, setOverview] = useState<SchoolFinanceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!school || !currentAcademicYear) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setOverview(await feeService.getSchoolFinanceOverview(school.id, currentAcademicYear.id));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the finance overview.'));
    } finally {
      setIsLoading(false);
    }
  }, [school, currentAcademicYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSendReminders = async () => {
    if (!school) return;
    setIsSendingReminders(true);
    setReminderResult(null);
    setReminderError(null);
    try {
      const sentCount = await feeService.triggerOverdueReminders(school.id);
      setReminderResult(
        sentCount === 0
          ? 'No reminders to send — everything currently overdue was already reminded recently.'
          : `Sent ${sentCount} reminder${sentCount === 1 ? '' : 's'}.`,
      );
    } catch (err) {
      setReminderError(getDbErrorMessage(err, 'Failed to send overdue reminders.'));
    } finally {
      setIsSendingReminders(false);
    }
  };

  const collectionRate = overview ? calculateCollectionRate(overview) : null;

  return (
    <PageContainer>
      <PageHeader
        title="Finance Overview"
        description="School-wide fee collection position for the active academic year."
        action={
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/fees/reconciliation" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              Bank reconciliation
            </Link>
            <Link to="/fees/structures" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              Manage fee structures
            </Link>
          </div>
        }
      />

      <ErrorAlert message={error ?? reminderError} />

      {canManageFinancial && school && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-auto sm:min-w-[12rem]">
            <Button type="button" variant="secondary" isLoading={isSendingReminders} onClick={() => void handleSendReminders()}>
              {isSendingReminders ? 'Sending…' : 'Send overdue reminders now'}
            </Button>
          </div>
          {reminderResult && <p className="text-sm text-content-secondary">{reminderResult}</p>}
        </div>
      )}

      {!school ? (
        <NoActiveSchoolNotice resource="finance overview" />
      ) : !currentAcademicYear ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No active academic year.
        </div>
      ) : isLoading ? (
        <LoadingBlock label="Loading finance overview…" />
      ) : !overview ? null : (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard label="Total billed" value={formatCurrency(overview.totalCharged)} />
            <SummaryCard label="Discounts / bursaries" value={formatCurrency(overview.totalAdjustments)} />
            <SummaryCard label="Collected (net)" value={formatCurrency(overview.netPaid)} />
            <SummaryCard label="Outstanding" value={formatCurrency(overview.outstandingBalance)} />
            <SummaryCard label="Overdue" value={formatCurrency(overview.overdueBalance)} />
          </dl>

          {collectionRate !== null && (
            <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
              <p className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Collection rate</p>
              <p className="mt-1 text-2xl font-bold text-content-primary">{collectionRate}%</p>
              <p className="mt-1 text-xs text-content-tertiary">Net collected against billed, after discounts/bursaries/scholarships.</p>
            </div>
          )}

          <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
            <h3 className="mb-4 text-sm font-semibold text-content-primary">Learners by status ({overview.learnerCount} with a fee record)</h3>
            <div className="flex flex-col gap-3">
              <SummaryBar label="Paid" count={overview.statusCounts.paid} total={overview.learnerCount} />
              <SummaryBar label="Partially paid" count={overview.statusCounts.partially_paid} total={overview.learnerCount} />
              <SummaryBar label="Outstanding" count={overview.statusCounts.outstanding} total={overview.learnerCount} />
              <SummaryBar label="Overdue" count={overview.statusCounts.overdue} total={overview.learnerCount} />
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
            <h3 className="mb-4 text-sm font-semibold text-content-primary">Outstanding balance ageing</h3>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-content-tertiary">Current / 0–30 days</dt>
                <dd className="font-mono font-medium text-content-primary">{formatCurrency(overview.agingBuckets.current)}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-tertiary">31–60 days</dt>
                <dd className="font-mono font-medium text-content-primary">{formatCurrency(overview.agingBuckets.days30)}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-tertiary">61–90 days</dt>
                <dd className="font-mono font-medium text-content-primary">{formatCurrency(overview.agingBuckets.days60)}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-tertiary">90+ days</dt>
                <dd className="font-mono font-medium text-content-primary">{formatCurrency(overview.agingBuckets.days90Plus)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-content-primary">Debtor list</h3>
              <ExportCsvButton
                rows={overview.learnerBalances.map((row) => ({ ...row, status: STATUS_LABELS[row.status] }))}
                columns={DEBTOR_LIST_COLUMNS}
                filename={`${school.name}-debtor-list-${currentAcademicYear.name}.csv`}
                label="Export debtor list"
                permission="learner.manage_financial"
              />
            </div>
            {overview.learnerBalances.length === 0 ? (
              <p className="text-sm text-content-tertiary">No fee records yet.</p>
            ) : (
              <TableScrollContainer>
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                      <th scope="col" className="px-3 py-2 font-medium">Learner</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.learnerBalances.slice(0, 25).map((row) => (
                      <tr key={row.learnerId} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-content-primary">
                          {row.learnerName} <span className="text-content-tertiary">({row.learnerNumber})</span>
                        </td>
                        <td className="px-3 py-2 text-content-secondary">{STATUS_LABELS[row.status]}</td>
                        <td className="px-3 py-2 text-right font-mono text-content-primary">{formatCurrency(row.outstandingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScrollContainer>
            )}
            {overview.learnerBalances.length > 25 && (
              <p className="mt-3 text-xs text-content-tertiary">
                Showing the top 25 of {overview.learnerBalances.length} learners by outstanding balance — export the full list above.
              </p>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
