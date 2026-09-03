import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useSchoolInvoices } from '@/features/fees/hooks/useInvoices';
import type { InvoicePresentationStatus } from '@/features/fees/types/invoice.types';

const STATUS_FILTERS: { value: 'all' | InvoicePresentationStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Partly paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

function money(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** School-wide invoice register for the active academic year — the finance office's list of every invoice raised. */
export function InvoicesRegisterPage() {
  const { school } = useSchool();
  const { currentAcademicYear } = useAcademic();
  const { invoices, isLoading, error } = useSchoolInvoices(school?.id, currentAcademicYear?.id);
  const [statusFilter, setStatusFilter] = useState<'all' | InvoicePresentationStatus>('all');

  const filtered = useMemo(
    () => (statusFilter === 'all' ? invoices : invoices.filter((i) => i.presentationStatus === statusFilter)),
    [invoices, statusFilter],
  );

  const totals = useMemo(() => {
    const billed = filtered.reduce((sum, i) => sum + (i.status === 'void' ? 0 : i.total || i.subtotal), 0);
    const outstanding = filtered.reduce((sum, i) => sum + i.balance, 0);
    return { billed, outstanding };
  }, [filtered]);

  if (!school) return <NoActiveSchoolNotice resource="invoices" />;

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description={`Invoice register for ${currentAcademicYear?.name ?? 'the active academic year'}.`}
      />

      {isLoading ? (
        <LoadingBlock label="Loading invoices…" />
      ) : (
        <div className="flex flex-col gap-4">
          <ErrorAlert message={error} />

          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`focus-ring rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === f.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-raised text-content-secondary hover:bg-surface-sunken'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface-raised p-4">
            <div>
              <dt className="text-xs text-content-tertiary">Billed (shown)</dt>
              <dd className="font-mono font-semibold text-content-primary">{money(totals.billed)}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-tertiary">Outstanding (shown)</dt>
              <dd className="font-mono font-semibold text-content-primary">{money(totals.outstanding)}</dd>
            </div>
          </dl>

          {filtered.length === 0 ? (
            <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
              No invoices match this filter.
            </p>
          ) : (
            <TableScrollContainer>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                    <th scope="col" className="px-4 py-3 font-medium">Number</th>
                    <th scope="col" className="px-4 py-3 font-medium">Learner</th>
                    <th scope="col" className="px-4 py-3 font-medium">Issued</th>
                    <th scope="col" className="px-4 py-3 font-medium">Due</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-content-primary">{invoice.invoiceNumber ?? '— (draft)'}</td>
                      <td className="px-4 py-3">
                        <Link to={`/learners/${invoice.learnerId}`} className="text-brand-600 hover:underline dark:text-brand-300">
                          {invoice.learnerName ?? 'View learner'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-content-secondary">{formatDate(invoice.issueDate)}</td>
                      <td className="px-4 py-3 text-content-secondary">{formatDate(invoice.dueDate)}</td>
                      <td className="px-4 py-3 capitalize text-content-secondary">
                        {invoice.presentationStatus.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-content-primary">{money(invoice.total || invoice.subtotal)}</td>
                      <td className="px-4 py-3 text-right font-mono text-content-primary">{money(invoice.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollContainer>
          )}
        </div>
      )}
    </PageContainer>
  );
}
