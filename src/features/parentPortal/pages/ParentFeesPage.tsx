import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useMyLearners } from '@/features/learners/hooks/useMyLearners';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useLearnerFees } from '@/features/fees/hooks/useLearnerFees';
import { useLearnerInvoices } from '@/features/fees/hooks/useInvoices';
import { invoiceService } from '@/features/fees/services/invoiceService';
import { PayInvoiceButton } from '@/features/fees/components/PayInvoiceButton';
import {
  generateStatementPdf,
  generateInvoicePdf,
  generateReceiptPdf,
  type SchoolBillingInfo,
} from '@/features/fees/utils/generateFeeDocumentPdf';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { Learner } from '@/features/learners/types/learner.types';
import type { FeeReceipt } from '@/features/fees/types/invoice.types';

function money(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value.length > 10 ? value : `${value}T00:00:00`).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ChildFeesCard({ learner, school }: { learner: Learner; school: SchoolBillingInfo }) {
  const learnerName = `${learner.firstName} ${learner.lastName}`;
  const { summary, isLoading: feesLoading } = useLearnerFees(learner.id);
  const { invoices, isLoading: invLoading } = useLearnerInvoices(learner.id);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoiceService
      .listReceiptsForLearner(learner.id)
      .then((r) => !cancelled && setReceipts(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [learner.id, invoices]);

  const issued = invoices.filter((i) => i.status === 'issued');

  const downloadInvoice = async (invoiceId: string) => {
    setBusy(`inv-${invoiceId}`);
    setError(null);
    try {
      const detail = await invoiceService.getInvoice(invoiceId);
      if (!detail) throw new Error('Invoice not found');
      const doc = await generateInvoicePdf(detail, school, learnerName);
      doc.save(`invoice-${detail.invoiceNumber ?? 'draft'}.pdf`);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Could not download the invoice.'));
    } finally {
      setBusy(null);
    }
  };

  const downloadReceipt = async (receipt: FeeReceipt) => {
    setBusy(`rct-${receipt.id}`);
    setError(null);
    try {
      const payments = summary?.payments ?? [];
      const payment = payments.find((p) => p.id === receipt.paymentId);
      const doc = await generateReceiptPdf(receipt, school, learnerName, {
        amount: payment?.amount ?? 0,
        paymentDate: payment?.paymentDate ?? receipt.issuedAt.slice(0, 10),
        method: payment?.method ?? 'other',
        reference: payment?.reference ?? null,
      });
      doc.save(`receipt-${receipt.receiptNumber}.pdf`);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Could not download the receipt.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-content-primary">{learnerName}</h2>
        {summary && (
          <span className="font-mono text-sm font-semibold text-content-primary">
            {money(summary.outstandingBalance)} outstanding
          </span>
        )}
      </div>

      <ErrorAlert message={error} />

      {feesLoading || invLoading ? (
        <LoadingBlock label="Loading…" />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-primary">Invoices</h3>
            {issued.length === 0 ? (
              <p className="text-sm text-content-tertiary">No invoices issued.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {issued.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-content-primary">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-content-tertiary">
                        Due {formatDate(invoice.dueDate)} · {money(invoice.total)} · Balance {money(invoice.balance)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void downloadInvoice(invoice.id)}
                        disabled={busy === `inv-${invoice.id}`}
                        className="focus-ring rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300"
                      >
                        PDF
                      </button>
                      {invoice.balance > 0 && (
                        <PayInvoiceButton
                          learnerId={learner.id}
                          invoiceId={invoice.id}
                          amount={invoice.balance}
                          label={`Pay ${money(invoice.balance)}`}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-primary">Receipts</h3>
            {receipts.length === 0 ? (
              <p className="text-sm text-content-tertiary">No receipts yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {receipts.map((receipt) => (
                  <li
                    key={receipt.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-sm text-content-primary">
                      {receipt.receiptNumber} · {formatDate(receipt.issuedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void downloadReceipt(receipt)}
                      disabled={busy === `rct-${receipt.id}`}
                      className="focus-ring rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300"
                    >
                      PDF
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Family-wide fee view for guardians: per-child invoices, receipts, online payment, and a combined statement. */
export function ParentFeesPage() {
  const { data: learners, isLoading, error } = useMyLearners();
  const { school } = useSchool();
  const [statementBusy, setStatementBusy] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);

  const billing: SchoolBillingInfo = {
    name: school?.name ?? 'Your school',
    address: school?.physicalAddress,
    email: school?.email,
    phone: school?.phone,
    vatNumber: school?.vatNumber,
    bankingDetails: school?.bankingDetails,
    footerNote: school?.invoiceFooterNote,
  };

  const downloadFamilyStatement = async () => {
    setStatementBusy(true);
    setStatementError(null);
    try {
      const asOf = new Date().toISOString().slice(0, 10);
      const statement = await invoiceService.getFamilyStatement(
        learners.map((l) => l.id),
        asOf,
      );
      const doc = await generateStatementPdf(statement, billing, 'Family account', asOf);
      doc.save('family-statement.pdf');
    } catch (err) {
      setStatementError(getDbErrorMessage(err, 'Could not generate the family statement.'));
    } finally {
      setStatementBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Fees" description="Invoices, statements, receipts and online payments for your children." />

      {isLoading ? (
        <LoadingBlock label="Loading your account…" />
      ) : (
        <div className="flex flex-col gap-6">
          <ErrorAlert message={error ?? statementError} />

          {learners.length > 1 && (
            <div className="w-full sm:w-64">
              <Button type="button" variant="secondary" onClick={() => void downloadFamilyStatement()} isLoading={statementBusy}>
                Download family statement
              </Button>
            </div>
          )}

          {learners.length === 0 ? (
            <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
              No linked children on file.
            </p>
          ) : (
            learners.map((learner) => <ChildFeesCard key={learner.id} learner={learner} school={billing} />)
          )}
        </div>
      )}
    </PageContainer>
  );
}
