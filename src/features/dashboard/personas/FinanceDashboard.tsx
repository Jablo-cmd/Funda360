import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { feeService, type SchoolFinanceOverview } from '@/features/fees/services/feeService';
import { calculateCollectionRate } from '@/features/fees/utils/calculations';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { GearIcon, LayersIcon, WalletIcon } from '@/components/ui/icons';
import {
  DashboardHeading,
  DashboardScreen,
  EmptyPanelMessage,
  InfoPanel,
  QuickActionsPanel,
  StatPanel,
  type QuickAction,
} from '@/features/dashboard/components/DashboardPrimitives';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

/** Finance workspace dashboard — accountant, finance manager. */
export function FinanceDashboard() {
  const { profile } = useProfile();
  const { tenant } = useTenant();
  const { school } = useSchool();
  const { can } = usePermissions();
  const { currentAcademicYear } = useAcademic();
  const canManageFinance = can('learner.manage_financial');

  const [overview, setOverview] = useState<SchoolFinanceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!school || !currentAcademicYear) {
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    feeService
      .getSchoolFinanceOverview(school.id, currentAcademicYear.id)
      .then((data) => {
        if (isMounted) setOverview(data);
      })
      .catch((err) => {
        if (isMounted) setError(getDbErrorMessage(err, 'Failed to load the finance overview.'));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [school, currentAcademicYear]);

  const collectionRate = overview ? calculateCollectionRate(overview) : null;
  const debtors = (overview?.learnerBalances ?? []).filter((r) => r.outstandingBalance > 0);
  const topDebtors = debtors.slice(0, 6);

  const quickActions: QuickAction[] = [
    { label: 'Invoices', description: 'Issue, view and allocate invoices.', to: '/fees/invoices', icon: WalletIcon },
    { label: 'Finance Overview', description: 'Collections, ageing and the full debtor list.', to: '/fees', icon: WalletIcon },
    { label: 'Bank Reconciliation', description: 'Match bank statement lines to payments.', to: '/fees/reconciliation', icon: WalletIcon },
    ...(canManageFinance
      ? [
          { label: 'Fee Structures', description: 'Maintain the fee catalogue.', to: '/fees/structures', icon: LayersIcon },
          { label: 'Payment Settings', description: 'Billing details and payment gateway.', to: '/fees/settings', icon: GearIcon },
        ]
      : []),
  ];

  return (
    <DashboardScreen>
      <DashboardHeading
        title={`Welcome back${profile?.firstName ? `, ${profile.firstName}` : ''}`}
        subtitle={`Finance${tenant?.school.name ? ` · ${tenant.school.name}` : ''}${
          currentAcademicYear ? ` · ${currentAcademicYear.name}` : ''
        }`}
      />

      {!school ? (
        <NoActiveSchoolNotice resource="the finance workspace" />
      ) : (
        <>
          <ErrorAlert message={error} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatPanel
              label="Outstanding Fees"
              value={overview ? formatCurrency(overview.outstandingBalance) : '—'}
              caption="Billed and not yet collected"
              to="/fees"
              isLoading={isLoading}
            />
            <StatPanel
              label="Overdue"
              value={overview ? formatCurrency(overview.overdueBalance) : '—'}
              caption="Past the due date"
              to="/fees"
              isLoading={isLoading}
            />
            <StatPanel
              label="Collection Rate"
              value={collectionRate !== null ? `${collectionRate}%` : '—'}
              caption="Net collected vs. billed, this year"
              to="/fees"
              isLoading={isLoading}
            />
            <StatPanel
              label="Debtor Accounts"
              value={overview ? String(debtors.length) : '—'}
              caption="Learners with a balance owing"
              to="/fees"
              isLoading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoPanel title="Top Debtors">
              {isLoading ? (
                <EmptyPanelMessage message="Loading debtors…" />
              ) : topDebtors.length === 0 ? (
                <EmptyPanelMessage message="No outstanding balances." />
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {topDebtors.map((row) => (
                    <Link
                      key={row.learnerId}
                      to={`/learners/${row.learnerId}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors first:pt-0 last:pb-0 hover:text-brand-600 dark:hover:text-brand-300"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-content-primary">{row.learnerName}</span>
                        <span className="block truncate text-xs text-content-tertiary">{row.learnerNumber}</span>
                      </span>
                      <span className="shrink-0 font-mono text-sm text-danger-600">
                        {formatCurrency(row.outstandingBalance)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </InfoPanel>

            <QuickActionsPanel actions={quickActions} />
          </div>
        </>
      )}
    </DashboardScreen>
  );
}
