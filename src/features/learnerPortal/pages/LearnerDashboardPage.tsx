import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useProfile } from '@/features/profile/context/profileContext';
import { useMyLearnerRecord } from '@/features/learnerPortal/hooks/useMyLearnerRecord';
import { homeworkService } from '@/features/homework/services/homeworkService';
import { isMissing } from '@/features/homework/utils/homeworkDisplay';

const LINKS = [
  { label: 'Timetable', to: '/learner/timetable' },
  { label: 'Homework', to: '/learner/homework' },
  { label: 'Results', to: '/learner/results' },
  { label: 'Report cards', to: '/learner/report-cards' },
  { label: 'Attendance', to: '/learner/attendance' },
  { label: 'Announcements', to: '/learner/announcements' },
];

export function LearnerDashboardPage() {
  const { profile } = useProfile();
  const { record, isLoading } = useMyLearnerRecord();
  const [homework, setHomework] = useState<{ due: number; missing: number } | null>(null);

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    homeworkService
      .listAssignmentsForLearners([record.id])
      .then((items) => {
        if (cancelled) return;
        const due = items.filter(
          ({ submission }) => submission.status === 'assigned' || submission.status === 'returned',
        ).length;
        const missing = items.filter(({ assignment, submission }) => isMissing(submission, assignment.dueAt)).length;
        setHomework({ due, missing });
      })
      .catch(() => setHomework(null));
    return () => {
      cancelled = true;
    };
  }, [record]);

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-bold text-content-primary">
          Hi{profile ? `, ${profile.firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-content-secondary">Everything for school, in one place.</p>
      </div>

      {isLoading ? (
        <LoadingBlock label="Loading…" />
      ) : !record ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          Your learner record isn&rsquo;t linked to this account yet. Please contact your school.
        </div>
      ) : (
        <>
          {homework && (homework.due > 0 || homework.missing > 0) && (
            <section className="rounded-card border border-border bg-surface-raised p-4">
              <h2 className="text-base font-semibold text-content-primary">Homework</h2>
              <p className="mt-1 text-sm text-content-secondary">
                {homework.due} to do
                {homework.missing > 0 && <span className="text-danger-600"> · {homework.missing} overdue</span>}
              </p>
              <Link to="/learner/homework" className="mt-1 inline-block text-sm font-medium text-brand-600 hover:underline">
                Open homework
              </Link>
            </section>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="focus-ring rounded-card border border-border bg-surface-raised px-4 py-6 text-center text-sm font-medium text-content-primary hover:bg-surface-sunken"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
