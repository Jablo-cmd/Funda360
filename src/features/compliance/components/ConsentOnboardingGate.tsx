import type { ReactNode } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ComplianceBadge } from '@/components/ui/complianceIcons';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import { getMyPrivacyOverview } from '@/features/compliance/services/complianceService';
import {
  childNeedsDecision,
  requiredPurposes,
} from '@/features/compliance/constants/consentPurposes';
import { ConsentDecisionForm } from '@/features/compliance/components/ConsentDecisionForm';

/**
 * Consent at onboarding (COPPA direct notice + verifiable consent, POPIA
 * s.35, GDPR Art. 8). Until a guardian has decided — granted OR refused —
 * every required purpose for every linked child, the portal shows this step
 * instead of its pages. Refusing is a first-class answer: it unlocks the
 * portal exactly like consenting does. The server enforces the consequences
 * regardless of this screen (no child login or child submissions without
 * consent), so skipping the UI never skips the rule.
 *
 * If the overview cannot be loaded the portal is shown rather than locking a
 * parent out; the database-side enforcement still holds.
 */
export function ConsentOnboardingGate({ children }: { children: ReactNode }) {
  const overview = useAsyncData(getMyPrivacyOverview, [], 'Could not load your consent status.');

  if (overview.isLoading && !overview.data) {
    return <LoadingBlock label="Checking consent status…" className="py-24" />;
  }

  const pendingChildren = overview.data?.children.filter(childNeedsDecision) ?? [];
  if (!overview.data || pendingChildren.length === 0) return <>{children}</>;

  const child = pendingChildren[0]!;
  return (
    <PageContainer width="md">
      <div className="rounded-card border border-t-4 border-border border-t-accent-500 bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <ComplianceBadge icon="coppa" size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">
              Step {overview.data.children.length - pendingChildren.length + 1} of{' '}
              {overview.data.children.length} · Privacy & consent
            </p>
            <h1 className="mt-1 text-xl font-semibold text-content-primary">
              Your decisions for {child.name}
            </h1>
            <p className="mt-2 text-sm text-content-secondary">
              Before you continue,{' '}
              {overview.data.settings.information_officer_name
                ? `${overview.data.settings.information_officer_name}, the school's Information Officer, needs`
                : 'the school needs'}{' '}
              your decision on how {child.name}'s information is used. Nothing is pre-selected and
              you can change any decision later under Privacy & Records.
              {child.under_coppa_age &&
                ` Because ${child.name} is under ${overview.data.settings.coppa_consent_age}, an online account needs your consent first.`}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <ConsentDecisionForm
            key={child.learner_id}
            child={child}
            privacyNoticeVersion={overview.data.settings.privacy_notice_version}
            required={requiredPurposes(child.under_coppa_age)}
            purposes={requiredPurposes(child.under_coppa_age)}
            submitLabel={
              pendingChildren.length > 1 ? 'Save and continue' : 'Save and open the portal'
            }
            onSaved={overview.reload}
          />
        </div>
      </div>
    </PageContainer>
  );
}
