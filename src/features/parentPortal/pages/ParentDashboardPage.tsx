import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useProfile } from '@/features/profile/context/profileContext';
import { useMyLearners } from '@/features/learners/hooks/useMyLearners';
import { ChildCard } from '@/features/parentPortal/components/ChildCard';
import { useParentPortalHome } from '@/features/parentPortal/hooks/useParentPortalHome';

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  incomplete: 'Awaiting documents',
  interview_required: 'Interview scheduled',
  assessment_required: 'Assessment scheduled',
  waitlisted: 'Waitlisted',
  accepted: 'Accepted',
  rejected: 'Not successful',
  withdrawn: 'Withdrawn',
  enrolled: 'Enrolled',
};

export function ParentDashboardPage() {
  const { profile } = useProfile();
  const { data: children, isLoading, error } = useMyLearners();
  const activeChildren = children.filter((child) => child.status !== 'withdrawn' && child.status !== 'transferred');
  const { data: home } = useParentPortalHome(children.map((c) => c.id));

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

      {home && (home.homeworkDue.length > 0 || home.applications.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {home.homeworkDue.length > 0 && (
            <section className="rounded-card border border-border bg-surface-raised p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold text-content-primary">Homework to do</h2>
                <Link to="/parent/homework" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                  All homework
                </Link>
              </div>
              {home.homeworkMissingCount > 0 && (
                <p className="mb-2 text-sm text-danger-600">
                  {home.homeworkMissingCount} assignment{home.homeworkMissingCount === 1 ? '' : 's'} overdue
                </p>
              )}
              <ul className="flex flex-col gap-1 text-sm">
                {home.homeworkDue.map(({ assignment }) => (
                  <li key={assignment.id}>
                    <Link to={`/parent/homework/${assignment.id}`} className="text-content-primary hover:underline">
                      {assignment.title}
                    </Link>{' '}
                    <span className="text-content-tertiary">· {assignment.subjectName}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {home.applications.length > 0 && (
            <section className="rounded-card border border-border bg-surface-raised p-4">
              <h2 className="mb-2 text-base font-semibold text-content-primary">Your applications</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {home.applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="text-content-primary">
                      {a.learnerName}
                      {a.referenceNumber ? ` · ${a.referenceNumber}` : ''}
                    </span>
                    <span className="text-content-tertiary">{APPLICATION_STATUS_LABELS[a.status] ?? a.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
