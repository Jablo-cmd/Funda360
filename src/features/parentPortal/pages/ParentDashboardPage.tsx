import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useProfile } from '@/features/profile/context/profileContext';
import { useMyLearners } from '@/features/learners/hooks/useMyLearners';
import { ChildCard } from '@/features/parentPortal/components/ChildCard';

export function ParentDashboardPage() {
  const { profile } = useProfile();
  const { data: children, isLoading, error } = useMyLearners();
  const activeChildren = children.filter((child) => child.status !== 'withdrawn' && child.status !== 'transferred');

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-bold text-content-primary">Welcome{profile ? `, ${profile.firstName}` : ''}</h1>
        <p className="mt-1 text-sm text-content-secondary">Here's what's happening with your children.</p>
      </div>

      <ErrorAlert message={error} />

      {isLoading ? (
        <LoadingBlock label="Loading your children…" />
      ) : activeChildren.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No learners are linked to your account yet. Contact your school if this doesn't look right.
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-content-primary">My Children</h2>
            {activeChildren.length > 1 && (
              <Link to="/parent/children" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                View all
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeChildren.map((child) => (
              <ChildCard key={child.id} learner={child} />
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
