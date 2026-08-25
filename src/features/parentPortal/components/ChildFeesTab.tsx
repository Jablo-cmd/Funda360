import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useLearnerFees } from '@/features/fees/hooks/useLearnerFees';

export interface ChildFeesTabProps {
  learnerId: string;
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid in full',
  partially_paid: 'Partially paid',
  outstanding: 'Outstanding',
  overdue: 'Overdue',
};

const STATUS_CLASSES: Record<string, string> = {
  paid: 'bg-success-500/10 text-success-500',
  partially_paid: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  outstanding: 'bg-surface-sunken text-content-tertiary',
  overdue: 'bg-danger-50 text-danger-600',
};

const CATEGORY_LABELS: Record<string, string> = {
  tuition: 'Tuition',
  transport: 'Transport',
  boarding: 'Boarding',
  uniform: 'Uniform',
  activity: 'Activity',
  other: 'Other',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Read-only — a guardian can view their own linked learner's fees but has no INSERT/UPDATE access at the RLS layer; no "Add charge"/"Record payment" actions are offered here. */
export function ChildFeesTab({ learnerId }: ChildFeesTabProps) {
  const { summary, isLoading, error } = useLearnerFees(learnerId);

  if (isLoading) {
    return <LoadingBlock label="Loading fee information…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert message={error} />

      {!summary || summary.totalCharged === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No fee information on file yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-border bg-surface-raised p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Total charged</p>
              <p className="mt-1 text-xl font-bold text-content-primary">{formatCurrency(summary.totalCharged)}</p>
            </div>
            <div className="rounded-card border border-border bg-surface-raised p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Total paid</p>
              <p className="mt-1 text-xl font-bold text-content-primary">{formatCurrency(summary.totalPaid)}</p>
            </div>
            <div className="rounded-card border border-border bg-surface-raised p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Outstanding balance</p>
              <p className="mt-1 text-xl font-bold text-content-primary">{formatCurrency(summary.outstandingBalance)}</p>
            </div>
          </div>

          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[summary.status]}`}
          >
            {STATUS_LABELS[summary.status]}
          </span>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-primary">Charges</h3>
            {summary.charges.length === 0 ? (
              <p className="text-sm text-content-tertiary">No charges recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {summary.charges.map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between rounded-card border border-border bg-surface-raised px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-content-primary">{charge.description}</p>
                      <p className="text-xs text-content-tertiary">
                        {CATEGORY_LABELS[charge.category]}
                        {charge.dueDate ? ` · Due ${formatDate(charge.dueDate)}` : ''}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-content-primary">{formatCurrency(charge.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-primary">Payments</h3>
            {summary.payments.length === 0 ? (
              <p className="text-sm text-content-tertiary">No payments recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {summary.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-card border border-border bg-surface-raised px-4 py-3">
                    <span className="text-sm text-content-primary">{formatDate(payment.paymentDate)}</span>
                    <span className="font-mono text-sm text-content-primary">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
