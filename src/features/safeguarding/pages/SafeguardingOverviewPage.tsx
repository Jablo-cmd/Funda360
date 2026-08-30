import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { safeguardingService } from '@/features/safeguarding/services/safeguardingService';
import type { SafeguardingConcern, SafeguardingSeverity, SafeguardingStatus } from '@/features/safeguarding/types/safeguarding.types';
import { supabase } from '@/lib/supabase';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { getDbErrorMessage } from '@/lib/dbErrors';

const SEVERITY_STYLES: Record<SafeguardingSeverity, string> = {
  low: 'bg-surface-sunken text-content-tertiary',
  medium: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  high: 'bg-danger-50 text-danger-600',
  critical: 'bg-danger-600 text-white',
};

const STATUS_LABELS: Record<SafeguardingStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The school-wide active-case list (open/under_review/escalated only —
 * resolved/closed cases are reviewed from the learner's own profile tab,
 * not here) — for school_owner/principal to see their current safeguarding
 * caseload without navigating learner-by-learner. Confidential: this
 * route, like the profile tab, only ever renders for learner.view_safeguarding.
 */
export function SafeguardingOverviewPage() {
  const { can } = usePermissions();
  const canView = can('learner.view_safeguarding');
  const { school } = useSchool();

  const [concerns, setConcerns] = useState<SafeguardingConcern[]>([]);
  const [learnerNamesById, setLearnerNamesById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!school || !canView) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    safeguardingService
      .getActiveConcerns(school.id)
      .then(async (results) => {
        setConcerns(results);
        const learnerIds = [...new Set(results.map((concern) => concern.learnerId))];
        if (learnerIds.length === 0) return;
        const { data, error: learnerError } = await supabase.from('learners').select('id, first_name, last_name').in('id', learnerIds);
        if (learnerError) throw learnerError;
        setLearnerNamesById(Object.fromEntries(data.map((row) => [row.id, `${row.first_name} ${row.last_name}`])));
      })
      .catch((err: unknown) => setError(getDbErrorMessage(err, 'Failed to load safeguarding concerns.')))
      .finally(() => setIsLoading(false));
  }, [school, canView]);

  return (
    <PageContainer>
      <PageHeader title="Safeguarding" description="Active child-safeguarding concerns for your school." />

      <p className="rounded-lg border border-warning-500/30 bg-warning-50 px-3.5 py-2.5 text-xs text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
        Confidential — visible only to the school owner and principal.
      </p>

      <ErrorAlert message={error} />

      {!school ? (
        <NoActiveSchoolNotice resource="safeguarding" />
      ) : isLoading ? (
        <LoadingBlock label="Loading…" />
      ) : concerns.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No active safeguarding concerns.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {concerns.map((concern) => (
            <li key={concern.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/learners/${concern.learnerId}`} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
                  {learnerNamesById[concern.learnerId] ?? 'Learner'}
                </Link>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${SEVERITY_STYLES[concern.severity]}`}>
                  {concern.severity}
                </span>
                <span className="text-xs font-medium text-content-tertiary">{STATUS_LABELS[concern.status]}</span>
              </div>
              <p className="mt-1.5 text-sm text-content-secondary">{concern.description}</p>
              <p className="mt-1.5 text-[11px] text-content-tertiary">Recorded {formatDate(concern.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
