import { useState } from 'react';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useLearnerInvoices } from '@/features/fees/hooks/useInvoices';
import { invoiceService } from '@/features/fees/services/invoiceService';
import { InvoiceFormModal } from '@/features/fees/components/InvoiceFormModal';
import { VoidInvoiceModal } from '@/features/fees/components/VoidInvoiceModal';
import { generateInvoicePdf, type SchoolBillingInfo } from '@/features/fees/utils/generateFeeDocumentPdf';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { InvoiceWithDetail, InvoicePresentationStatus } from '@/features/fees/types/invoice.types';

export interface InvoicesPanelProps {
  schoolId: string;
  learnerId: string;
  academicYearId: string | undefined;
  canManage: boolean;
  learnerName: string;
  school: SchoolBillingInfo;
  /** Called after any mutation so the parent financial summary can refresh. */
  onChanged: () => void;
}

const STATUS_LABELS: Record<InvoicePresentationStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Partly paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

const STATUS_CLASSES: Record<InvoicePresentationStatus, string> = {
  draft: 'bg-surface-sunken text-content-tertiary',
  issued: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  partially_paid: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  paid: 'bg-success-500/15 text-success-500',
  overdue: 'bg-danger-50 text-danger-600',
  void: 'bg-surface-sunken text-content-tertiary line-through',
};

function money(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function InvoicesPanel({
  schoolId,
  learnerId,
  academicYearId,
  canManage,
  learnerName,
  school,
  onChanged,
}: InvoicesPanelProps) {
  const { invoices, isLoading, error, refetch } = useLearnerInvoices(learnerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<InvoiceWithDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshAll = async () => {
    await refetch();
    onChanged();
  };

  const handleIssue = async (invoice: InvoiceWithDetail) => {
    setBusyId(invoice.id);
    setActionError(null);
    try {
      await invoiceService.issueInvoice(invoice.id);
      await refreshAll();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to issue the invoice.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (invoiceId: string) => {
    setBusyId(invoiceId);
    setActionError(null);
    try {
      const detail = await invoiceService.getInvoice(invoiceId);
      if (!detail) throw new Error('Invoice not found.');
      const doc = await generateInvoicePdf(detail, school, learnerName);
      doc.save(`invoice-${detail.invoiceNumber ?? 'draft'}.pdf`);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to generate the invoice PDF.'));
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) return <LoadingBlock label="Loading invoices…" />;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-content-primary">Invoices</h3>
        {canManage && academicYearId && (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="focus-ring rounded-md px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300"
          >
            New invoice
          </button>
        )}
      </div>

      <ErrorAlert message={error ?? actionError} />

      {invoices.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-8 text-center text-sm text-content-tertiary">
          No invoices raised.
        </p>
      ) : (
        <TableScrollContainer>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                <th scope="col" className="px-4 py-3 font-medium">Number</th>
                <th scope="col" className="px-4 py-3 font-medium">Issued</th>
                <th scope="col" className="px-4 py-3 font-medium">Due</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-content-primary">{invoice.invoiceNumber ?? '— (draft)'}</td>
                  <td className="px-4 py-3 text-content-secondary">{formatDate(invoice.issueDate)}</td>
                  <td className="px-4 py-3 text-content-secondary">{formatDate(invoice.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASSES[invoice.presentationStatus]}`}>
                      {STATUS_LABELS[invoice.presentationStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-content-primary">{money(invoice.total || invoice.subtotal)}</td>
                  <td className="px-4 py-3 text-right font-mono text-content-primary">{money(invoice.balance)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {invoice.status === 'issued' && (
                        <button
                          type="button"
                          onClick={() => void handleDownload(invoice.id)}
                          disabled={busyId === invoice.id}
                          className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300"
                        >
                          PDF
                        </button>
                      )}
                      {canManage && invoice.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => void handleIssue(invoice)}
                          disabled={busyId === invoice.id}
                          className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-success-600 hover:bg-success-500/10 disabled:opacity-50"
                        >
                          Issue
                        </button>
                      )}
                      {canManage && invoice.status !== 'void' && (
                        <button
                          type="button"
                          onClick={() => setVoidTarget(invoice)}
                          className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                        >
                          Void
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollContainer>
      )}

      {academicYearId && (
        <InvoiceFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={schoolId}
          learnerId={learnerId}
          academicYearId={academicYearId}
          onSaved={() => void refreshAll()}
        />
      )}
      <VoidInvoiceModal invoice={voidTarget} onClose={() => setVoidTarget(null)} onVoided={() => void refreshAll()} />
    </div>
  );
}
