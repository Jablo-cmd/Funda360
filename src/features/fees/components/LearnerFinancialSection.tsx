import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useLearnerFees } from '@/features/fees/hooks/useLearnerFees';
import { feeService } from '@/features/fees/services/feeService';
import { FeeChargeFormModal } from '@/features/fees/components/FeeChargeFormModal';
import { RecordPaymentFormModal } from '@/features/fees/components/RecordPaymentFormModal';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LearnerFinancialSectionProps {
  schoolId: string;
  learnerId: string;
  academicYearId: string | undefined;
  canManage: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CATEGORY_LABELS: Record<string, string> = {
  tuition: 'Tuition',
  transport: 'Transport',
  boarding: 'Boarding',
  uniform: 'Uniform',
  activity: 'Activity',
  other: 'Other',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  eft: 'EFT',
  card: 'Card',
  debit_order: 'Debit order',
  cheque: 'Cheque',
  other: 'Other',
};

export function LearnerFinancialSection({ schoolId, learnerId, academicYearId, canManage }: LearnerFinancialSectionProps) {
  const { summary, isLoading, error, refetch } = useLearnerFees(learnerId);
  const [isChargeOpen, setIsChargeOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleVoidCharge = async (id: string) => {
    setActionError(null);
    try {
      await feeService.voidCharge(id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to remove charge.'));
    }
  };

  const handleVoidPayment = async (id: string) => {
    setActionError(null);
    try {
      await feeService.voidPayment(id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to remove payment.'));
    }
  };

  if (isLoading) {
    return <LoadingBlock label="Loading fee information…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert message={error ?? actionError} />

      {canManage && academicYearId && (
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsChargeOpen(true)}>
              Add charge
            </Button>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" variant="secondary" onClick={() => setIsPaymentOpen(true)}>
              Record payment
            </Button>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-content-primary">Charges</h3>
        {!summary || summary.charges.length === 0 ? (
          <p className="rounded-card border border-border bg-surface-raised px-4 py-8 text-center text-sm text-content-tertiary">
            No charges recorded.
          </p>
        ) : (
          <TableScrollContainer>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                  <th scope="col" className="px-4 py-3 font-medium">Description</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="px-4 py-3 font-medium">Due date</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                  {canManage && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {summary.charges.map((charge) => (
                  <tr key={charge.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-content-primary">{charge.description}</td>
                    <td className="px-4 py-3 text-content-secondary">{CATEGORY_LABELS[charge.category]}</td>
                    <td className="px-4 py-3 text-content-secondary">{charge.dueDate ? formatDate(charge.dueDate) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-content-primary">{formatCurrency(charge.amount)}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleVoidCharge(charge.id)}
                          className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-content-primary">Payments</h3>
        {!summary || summary.payments.length === 0 ? (
          <p className="rounded-card border border-border bg-surface-raised px-4 py-8 text-center text-sm text-content-tertiary">
            No payments recorded.
          </p>
        ) : (
          <TableScrollContainer>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Method</th>
                  <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                  {canManage && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {summary.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-content-primary">{formatDate(payment.paymentDate)}</td>
                    <td className="px-4 py-3 text-content-secondary">{METHOD_LABELS[payment.method]}</td>
                    <td className="px-4 py-3 text-content-secondary">{payment.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-content-primary">{formatCurrency(payment.amount)}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleVoidPayment(payment.id)}
                          className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </div>

      {academicYearId && (
        <>
          <FeeChargeFormModal
            isOpen={isChargeOpen}
            onClose={() => setIsChargeOpen(false)}
            schoolId={schoolId}
            learnerId={learnerId}
            academicYearId={academicYearId}
            onSaved={() => void refetch()}
          />
          <RecordPaymentFormModal
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            schoolId={schoolId}
            learnerId={learnerId}
            academicYearId={academicYearId}
            onSaved={() => void refetch()}
          />
        </>
      )}
    </div>
  );
}
