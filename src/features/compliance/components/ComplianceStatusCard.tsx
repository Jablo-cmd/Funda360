import { Link } from 'react-router-dom';
import { ComplianceBadge } from '@/components/ui/complianceIcons';
import { useAuth } from '@/features/auth/context/authContext';
import { useCurrentSchool } from '@/features/tenant/hooks/useCurrentSchool';
import { hasPermission } from '@/features/rbac';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import { getComplianceOverview } from '@/features/compliance/services/complianceService';
import { StatusPill } from '@/features/compliance/components/ComplianceUi';
import { assessFrameworks } from '@/features/compliance/utils/frameworkStatus';

/** Data-protection status beside learner progress on the leadership dashboard. Renders nothing for roles without compliance.view. */
export function ComplianceStatusCard() {
  const { user } = useAuth();
  const school = useCurrentSchool();
  const allowed = hasPermission(user?.role ?? null, 'compliance.view') && !!school;
  const overview = useAsyncData(
    () => (allowed && school ? getComplianceOverview(school.id) : Promise.resolve(null)),
    [allowed, school?.id],
    'Could not load data-protection status.',
  );
  if (!allowed) return null;
  const o = overview.data;
  const frameworks = o ? assessFrameworks(o) : [];
  const openItems = o ? o.dsar.open + o.amendments.open + o.content_safety.open_events : 0;

  return (
    <section
      className="rounded-card border border-t-4 border-border border-t-accent-500 bg-surface-raised p-4 shadow-card dark:shadow-card-dark"
      aria-label="Data protection status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ComplianceBadge icon="popia" />
          <div>
            <h2 className="text-sm font-semibold text-content-primary">Data protection status</h2>
            <p className="text-xs text-content-secondary">
              {o
                ? `${openItems} open item${openItems === 1 ? '' : 's'} · ${o.dsar.overdue + o.amendments.overdue} overdue`
                : (overview.error ?? 'Measuring…')}
            </p>
          </div>
        </div>
        <Link
          to="/compliance"
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Open Trust Center
        </Link>
      </div>
      {frameworks.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {frameworks.map((f) => (
            <li
              key={f.framework}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-content-primary"
            >
              {f.title}
              <StatusPill status={f.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
