import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import type { LearnerFeeSummary } from '@/features/fees/types/fee.types';

export interface FinancialSummaryCardProps {
  summary: LearnerFeeSummary | null;
  isLoading: boolean;
  error: string | null;
  onViewAll: () => void;
}

const STATUS_LABELS: Record<LearnerFeeSummary['status'], string> = {
  paid: 'Paid / Up to date',
  partially_paid: 'Partially Paid',
  outstanding: 'Outstanding',
  overdue: 'Overdue',
};

const STATUS_CLASSES: Record<LearnerFeeSummary['status'], string> = {
  paid: 'bg-success-500/15 text-success-500',
  partially_paid: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  outstanding: 'bg-surface-sunken text-content-tertiary',
  overdue: 'bg-danger-50 text-danger-600',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function FinancialSummaryCard({ summary, isLoading, error, onViewAll }: FinancialSummaryCardProps) {
  return (
    <Card
      title="Financial Summary"
      action={
        <button type="button" onClick={onViewAll} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          View fees
        </button>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Loading financial summary…" compact />
      ) : error ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : !summary || summary.charges.length === 0 ? (
        <p className="text-sm text-content-tertiary">No charges have been recorded for this learner yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[summary.status]}`}
          >
            {STATUS_LABELS[summary.status]}
          </span>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-content-tertiary">Total charged</dt>
              <dd className="font-mono font-medium text-content-primary">{formatCurrency(summary.totalCharged)}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-tertiary">Amount paid</dt>
              <dd className="font-mono font-medium text-content-primary">{formatCurrency(summary.totalPaid)}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-tertiary">Outstanding balance</dt>
              <dd className="font-mono font-semibold text-content-primary">{formatCurrency(summary.outstandingBalance)}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-tertiary">Last payment</dt>
              <dd className="text-content-primary">
                {summary.lastPayment
                  ? `${formatCurrency(summary.lastPayment.amount)} · ${formatDate(summary.lastPayment.paymentDate)}`
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  );
}
