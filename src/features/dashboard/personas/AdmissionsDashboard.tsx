import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdmissionApplications } from '@/features/admissions/hooks/useAdmissionApplications';
import {
  ADMISSION_PIPELINE_STATUSES,
  ADMISSION_STATUS_LABELS,
} from '@/features/admissions/types/admission.types';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { BookIcon, ClipboardListIcon } from '@/components/ui/icons';
import {
  DashboardHeading,
  DashboardScreen,
  EmptyPanelMessage,
  InfoPanel,
  QuickActionsPanel,
  StatPanel,
  type QuickAction,
} from '@/features/dashboard/components/DashboardPrimitives';
import { formatStat } from '@/features/dashboard/utils';

const AWAITING_REVIEW = new Set(['submitted', 'under_review', 'incomplete']);

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

/** Admissions / front-office dashboard — admissions officer, receptionist. */
export function AdmissionsDashboard() {
  const { profile } = useProfile();
  const { tenant } = useTenant();
  const { school } = useSchool();
  const { can } = usePermissions();
  const canManage = can('admission.manage');

  const { applications, isLoading, error } = useAdmissionApplications(school?.id, {});

  const inPipeline = applications.filter((a) => ADMISSION_PIPELINE_STATUSES.includes(a.status));
  const awaitingReview = applications.filter((a) => AWAITING_REVIEW.has(a.status));
  const accepted = applications.filter((a) => a.status === 'accepted');
  const recent = [...applications]
    .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt))
    .slice(0, 6);

  const quickActions: QuickAction[] = [
    { label: 'Applications', description: 'Review and progress applications.', to: '/admissions', icon: ClipboardListIcon },
    ...(canManage
      ? [{ label: 'Document Requirements', description: 'Configure required documents.', to: '/admissions/requirements', icon: BookIcon }]
      : []),
  ];

  return (
    <DashboardScreen>
      <DashboardHeading
        title={`Welcome back${profile?.firstName ? `, ${profile.firstName}` : ''}`}
        subtitle={`Admissions${tenant?.school.name ? ` · ${tenant.school.name}` : ''}`}
      />

      {!school ? (
        <NoActiveSchoolNotice resource="admissions" />
      ) : (
        <>
          <ErrorAlert message={error} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatPanel
              label="In Pipeline"
              value={formatStat(inPipeline.length)}
              caption="Applications in the review funnel"
              to="/admissions"
              isLoading={isLoading}
            />
            <StatPanel
              label="Awaiting Review"
              value={formatStat(awaitingReview.length)}
              caption="Submitted, under review or incomplete"
              to="/admissions"
              isLoading={isLoading}
            />
            <StatPanel
              label="Accepted"
              value={formatStat(accepted.length)}
              caption="Offered a place, not yet enrolled"
              to="/admissions"
              isLoading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoPanel title="Recent Applications">
              {isLoading ? (
                <EmptyPanelMessage message="Loading applications…" />
              ) : recent.length === 0 ? (
                <EmptyPanelMessage message="No applications yet." />
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {recent.map((a) => (
                    <Link
                      key={a.id}
                      to={`/admissions/${a.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors first:pt-0 last:pb-0 hover:text-brand-600 dark:hover:text-brand-300"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-content-primary">
                          {[a.learnerFirstName, a.learnerLastName].filter(Boolean).join(' ') || 'Applicant'}
                        </span>
                        <span className="block truncate text-xs text-content-tertiary">
                          {ADMISSION_STATUS_LABELS[a.status]}
                          {a.referenceNumber ? ` · ${a.referenceNumber}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-content-tertiary">
                        {fmtDate(a.submittedAt ?? a.createdAt)}
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
