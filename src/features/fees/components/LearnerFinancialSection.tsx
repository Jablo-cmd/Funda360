import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useLearnerFees } from '@/features/fees/hooks/useLearnerFees';
import { feeService } from '@/features/fees/services/feeService';
import { invoiceService } from '@/features/fees/services/invoiceService';
import { FeeChargeFormModal } from '@/features/fees/components/FeeChargeFormModal';
import { RecordPaymentFormModal } from '@/features/fees/components/RecordPaymentFormModal';
import { FeeAdjustmentFormModal } from '@/features/fees/components/FeeAdjustmentFormModal';
import { RefundFormModal } from '@/features/fees/components/RefundFormModal';
import { InvoicesPanel } from '@/features/fees/components/InvoicesPanel';
import {
  generateReceiptPdf,
  generateStatementPdf,
  type SchoolBillingInfo,
} from '@/features/fees/utils/generateFeeDocumentPdf';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { LearnerFeePayment } from '@/features/fees/types/fee.types';

export interface LearnerFinancialSectionProps {
  schoolId: string;
  learnerId: string;
  learnerName: string;
  school: SchoolBillingInfo;
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

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  discount: 'Discount',
  bursary: 'Bursary',
  scholarship: 'Scholarship',
  waiver: 'Waiver',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  completed: 'Completed',
  rejected: 'Rejected',
};

const REFUND_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  completed: 'bg-success-500/15 text-success-500',
  rejected: 'bg-danger-50 text-danger-600',
};

export function LearnerFinancialSection({
  schoolId,
  learnerId,
  learnerName,
  school,
  academicYearId,
  canManage,
}: LearnerFinancialSectionProps) {
  const { summary, isLoading, error, refetch } = useLearnerFees(learnerId);
  const [isChargeOpen, setIsChargeOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<LearnerFeePayment | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDownloadStatement = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const asOf = new Date().toISOString().slice(0, 10);
      const statement = await invoiceService.getLearnerStatement(learnerId, asOf);
      const doc = await generateStatementPdf(statement, school, learnerName, asOf);
      doc.save(`statement-${learnerName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to generate the statement.'));
    } finally {
      setBusy(false);
    }
  };

  const handleReceipt = async (payment: LearnerFeePayment) => {
    setBusy(true);
    setActionError(null);
    try {
      const receipt = await invoiceService.issueReceipt(payment.id);
      const doc = await generateReceiptPdf(receipt, school, learnerName, {
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        method: payment.method,
        reference: payment.reference,
      });
      doc.save(`receipt-${receipt.receiptNumber}.pdf`);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to generate the receipt.'));
    } finally {
      setBusy(false);
    }
  };

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

  const handleVoidAdjustment = async (id: string) => {
    setActionError(null);
    try {
      await feeService.voidAdjustment(id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to remove adjustment.'));
    }
  };

  if (isLoading) {
    return <LoadingBlock label="Loading fee information…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert message={error ?? actionError} />

      {summary && (
        <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface-raised p-4 shadow-card sm:grid-cols-4 dark:shadow-card-dark">
          <div>
            <dt className="text-xs text-content-tertiary">Total charged</dt>
            <dd className="font-mono font-medium text-content-primary">{formatCurrency(summary.totalCharged)}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Net paid</dt>
            <dd className="font-mono font-medium text-content-primary">{formatCurrency(summary.netPaid)}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Discounts / bursaries</dt>
            <dd className="font-mono font-medium text-content-primary">{formatCurrency(summary.totalAdjustments)}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Outstanding balance</dt>
            <dd className="font-mono font-semibold text-content-primary">{formatCurrency(summary.outstandingBalance)}</dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap gap-3">
        {canManage && academicYearId && (
          <>
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
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" variant="secondary" onClick={() => setIsAdjustmentOpen(true)}>
                Add discount / bursary
              </Button>
            </div>
          </>
        )}
        <div className="w-full sm:w-auto sm:min-w-[9rem]">
          <Button type="button" variant="secondary" onClick={() => void handleDownloadStatement()} isLoading={busy}>
            Download statement
          </Button>
        </div>
      </div>

      {academicYearId && (
        <InvoicesPanel
          schoolId={schoolId}
          learnerId={learnerId}
          academicYearId={academicYearId}
          canManage={canManage}
          learnerName={learnerName}
          school={school}
          onChanged={() => void refetch()}
        />
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
        <h3 className="mb-2 text-sm font-semibold text-content-primary">Discounts, bursaries &amp; scholarships</h3>
        {!summary || summary.adjustments.length === 0 ? (
          <p className="rounded-card border border-border bg-surface-raised px-4 py-8 text-center text-sm text-content-tertiary">
            No adjustments recorded.
          </p>
        ) : (
          <TableScrollContainer>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                  {canManage && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {summary.adjustments.map((adjustment) => (
                  <tr key={adjustment.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-content-primary">{ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType]}</td>
                    <td className="px-4 py-3 text-content-secondary">{adjustment.reason}</td>
                    <td className="px-4 py-3 text-right font-mono text-content-primary">-{formatCurrency(adjustment.amount)}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleVoidAdjustment(adjustment.id)}
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
            <table className="w-full min-w-[600px] text-left text-sm">
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
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => void handleReceipt(payment)}
                            disabled={busy}
                            className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken disabled:opacity-50"
                          >
                            Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => setRefundTarget(payment)}
                            className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300"
                          >
                            Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleVoidPayment(payment.id)}
                            className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </div>

      {summary && summary.refunds.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-content-primary">Refunds</h3>
          <TableScrollContainer>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.refunds.map((refund) => (
                  <tr key={refund.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-content-primary">{formatDate(refund.refundDate)}</td>
                    <td className="px-4 py-3 text-content-secondary">{refund.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${REFUND_STATUS_CLASSES[refund.status]}`}>
                        {REFUND_STATUS_LABELS[refund.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-content-primary">-{formatCurrency(refund.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      )}

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
          <FeeAdjustmentFormModal
            isOpen={isAdjustmentOpen}
            onClose={() => setIsAdjustmentOpen(false)}
            schoolId={schoolId}
            learnerId={learnerId}
            academicYearId={academicYearId}
            charges={summary?.charges ?? []}
            onSaved={() => void refetch()}
          />
          <RefundFormModal
            isOpen={refundTarget !== null}
            onClose={() => setRefundTarget(null)}
            schoolId={schoolId}
            learnerId={learnerId}
            academicYearId={academicYearId}
            payment={refundTarget}
            onSaved={() => void refetch()}
          />
        </>
      )}
    </div>
  );
}
