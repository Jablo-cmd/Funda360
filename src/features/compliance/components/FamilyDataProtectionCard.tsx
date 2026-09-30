import { Link } from 'react-router-dom';
import { ComplianceBadge } from '@/components/ui/complianceIcons';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import { getMyPrivacyOverview } from '@/features/compliance/services/complianceService';
import { CONSENT_PURPOSE_TITLE } from '@/features/compliance/constants/consentPurposes';
import type { ConsentPurpose } from '@/lib/database.types';

/** The family-side trust dashboard: consent state per child beside their progress, with a route to Privacy & Records. */
export function FamilyDataProtectionCard({ basePath = '/parent' }: { basePath?: string }) {
  const overview = useAsyncData(getMyPrivacyOverview, [], 'Could not load your privacy status.');
  const children = overview.data?.children ?? [];
  if (!overview.data || children.length === 0) return null;

  return (
    <section
      className="rounded-card border border-t-4 border-border border-t-accent-500 bg-surface-raised p-4 shadow-card dark:shadow-card-dark"
      aria-label="Your data protection"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ComplianceBadge icon="ferpa" />
          <div>
            <h2 className="text-sm font-semibold text-content-primary">Your data protection</h2>
            <p className="text-xs text-content-secondary">
              POPIA · FERPA · GDPR — you control how your family's information is used.
            </p>
          </div>
        </div>
        <Link
          to={`${basePath}/privacy`}
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Privacy & Records
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {children.map((c) => {
          const decided = Object.entries(c.consents).filter(([, v]) => v != null) as Array<
            [ConsentPurpose, string]
          >;
          return (
            <li key={c.learner_id} className="text-sm">
              <span className="font-medium text-content-primary">{c.name}</span>
              <span className="text-content-secondary">
                {' '}
                —{' '}
                {decided
                  .filter(([, v]) => v === 'granted')
                  .map(([p]) => CONSENT_PURPOSE_TITLE[p])
                  .join(', ') || 'no consents given'}
                {c.open_requests + c.open_amendments > 0 &&
                  ` · ${c.open_requests + c.open_amendments} open request(s)`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
