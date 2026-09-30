import { useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useAuth } from '@/features/auth/context/authContext';
import { useCurrentSchool } from '@/features/tenant/hooks/useCurrentSchool';
import { hasPermission } from '@/features/rbac';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import { getComplianceOverview } from '@/features/compliance/services/complianceService';
import { OverviewTab } from '@/features/compliance/components/center/OverviewTab';
import { RequestsTab } from '@/features/compliance/components/center/RequestsTab';
import { ConsentTab } from '@/features/compliance/components/center/ConsentTab';
import { AuditTab } from '@/features/compliance/components/center/AuditTab';
import { SafetyTab } from '@/features/compliance/components/center/SafetyTab';
import { DisclosuresTab } from '@/features/compliance/components/center/DisclosuresTab';
import { SettingsTab } from '@/features/compliance/components/center/SettingsTab';

type TabKey = 'overview' | 'requests' | 'consent' | 'audit' | 'safety' | 'disclosures' | 'settings';

/**
 * The Trust Center: one place where a school's compliance officers (owner,
 * principal) run and evidence POPIA, FERPA, COPPA, CIPA and GDPR. Every
 * number is read from the database; every action goes through an audited
 * RPC. Access is gated by `compliance.view` here and by
 * is_compliance_officer() in the database.
 */
export function ComplianceCenterPage() {
  const { user } = useAuth();
  const school = useCurrentSchool();
  const canManage = hasPermission(user?.role ?? null, 'compliance.manage');
  const [tab, setTab] = useState<TabKey>('overview');
  const overview = useAsyncData(
    () => (school ? getComplianceOverview(school.id) : Promise.resolve(null)),
    [school?.id],
    'Could not load the compliance overview.',
  );

  if (!school) {
    return (
      <PageContainer>
        <NoActiveSchoolNotice resource="compliance records" />
      </PageContainer>
    );
  }

  const open = overview.data;
  const badge = (n: number | undefined) => (n ? ` (${n})` : '');

  return (
    <PageContainer>
      <PageHeader
        title="Trust Center"
        description={`Data protection and student privacy for ${school.name} — POPIA, FERPA, GDPR, COPPA and CIPA.`}
      />
      <Tabs<TabKey>
        tabs={[
          { key: 'overview', label: 'Overview' },
          {
            key: 'requests',
            label: `Requests${badge((open?.dsar.open ?? 0) + (open?.amendments.open ?? 0))}`,
          },
          { key: 'consent', label: 'Consent' },
          { key: 'audit', label: 'Audit logs' },
          { key: 'safety', label: `Safe content${badge(open?.content_safety.open_events)}` },
          { key: 'disclosures', label: 'Disclosures' },
          { key: 'settings', label: 'Settings' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />
      <ErrorAlert message={overview.error} />
      {overview.isLoading && !overview.data ? (
        <LoadingBlock label="Measuring compliance controls…" />
      ) : overview.data ? (
        <>
          {tab === 'overview' && <OverviewTab overview={overview.data} />}
          {tab === 'requests' && (
            <RequestsTab schoolId={school.id} canManage={canManage} onChanged={overview.reload} />
          )}
          {tab === 'consent' && (
            <ConsentTab
              schoolId={school.id}
              overview={overview.data}
              canManage={canManage}
              onChanged={overview.reload}
            />
          )}
          {tab === 'audit' && <AuditTab schoolId={school.id} />}
          {tab === 'safety' && (
            <SafetyTab schoolId={school.id} canManage={canManage} onChanged={overview.reload} />
          )}
          {tab === 'disclosures' && <DisclosuresTab schoolId={school.id} canManage={canManage} />}
          {tab === 'settings' && (
            <SettingsTab
              key={overview.data.settings.updated_at}
              schoolId={school.id}
              settings={overview.data.settings}
              canManage={canManage}
              onSaved={overview.reload}
            />
          )}
        </>
      ) : null}
    </PageContainer>
  );
}
