import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useMyLearners } from '@/features/learners/hooks/useMyLearners';
import { ChildCard } from '@/features/parentPortal/components/ChildCard';

export function ParentChildrenPage() {
  const { data: children, isLoading, error } = useMyLearners();
  const activeChildren = children.filter((child) => child.status !== 'withdrawn' && child.status !== 'transferred');

  return (
    <PageContainer>
      <PageHeader title="My Children" description="Learners linked to your account." />

      <ErrorAlert message={error} />

      {isLoading ? (
        <LoadingBlock label="Loading your children…" />
      ) : activeChildren.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No learners are linked to your account yet. Contact your school if this doesn't look right.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {activeChildren.map((child) => (
            <ChildCard key={child.id} learner={child} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
