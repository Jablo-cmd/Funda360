import type { ReactNode } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useMyLearnerRecord } from '@/features/learnerPortal/hooks/useMyLearnerRecord';
import { ChildAttendanceTab } from '@/features/parentPortal/components/ChildAttendanceTab';
import { ChildAcademicsTab } from '@/features/parentPortal/components/ChildAcademicsTab';
import { ChildTimetableTab } from '@/features/parentPortal/components/ChildTimetableTab';
import { ChildDocumentsTab } from '@/features/parentPortal/components/ChildDocumentsTab';
import { LearnerReportCardsSection } from '@/features/reportCards/components/LearnerReportCardsSection';

function LearnerSection({
  title,
  description,
  render,
}: {
  title: string;
  description?: string;
  render: (learnerId: string, schoolId: string | undefined) => ReactNode;
}) {
  const { record, isLoading, error } = useMyLearnerRecord();
  const { school } = useSchool();

  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <ErrorAlert message={error} />
      {isLoading ? (
        <LoadingBlock label="Loading…" />
      ) : !record ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          Your learner record isn&rsquo;t linked to this account yet. Please contact your school.
        </div>
      ) : (
        render(record.id, school?.id)
      )}
    </PageContainer>
  );
}

export function LearnerTimetablePage() {
  return (
    <LearnerSection
      title="Timetable"
      render={(learnerId, schoolId) =>
        schoolId ? <ChildTimetableTab learnerId={learnerId} schoolId={schoolId} /> : null
      }
    />
  );
}

export function LearnerResultsPage() {
  return <LearnerSection title="Results" render={(learnerId) => <ChildAcademicsTab learnerId={learnerId} />} />;
}

export function LearnerAttendancePage() {
  return <LearnerSection title="Attendance" render={(learnerId) => <ChildAttendanceTab learnerId={learnerId} />} />;
}

export function LearnerDocumentsPage() {
  return <LearnerSection title="Documents" render={(learnerId) => <ChildDocumentsTab learnerId={learnerId} />} />;
}

export function LearnerReportCardsPage() {
  const { school } = useSchool();
  return (
    <LearnerSection
      title="Report cards"
      render={(learnerId) => (
        <LearnerReportCardsSection
          learnerId={learnerId}
          variant="family"
          schoolName={school?.name ?? 'School'}
          schoolAddress={school?.physicalAddress}
        />
      )}
    />
  );
}

export function LearnerProfilePage() {
  return (
    <LearnerSection
      title="My Profile"
      render={(_learnerId) => <LearnerProfileBody />}
    />
  );
}

function LearnerProfileBody() {
  const { record } = useMyLearnerRecord();
  return (
    <div className="flex max-w-md flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 text-sm">
      <div>
        <span className="text-content-tertiary">Name</span>
        <p className="font-medium text-content-primary">
          {record?.firstName} {record?.lastName}
        </p>
      </div>
      <div>
        <span className="text-content-tertiary">Learner number</span>
        <p className="font-medium text-content-primary">{record?.learnerNumber}</p>
      </div>
      <p className="text-content-tertiary">
        To change your password, sign out and use &ldquo;Forgot password&rdquo;. Contact your school to update any other
        details.
      </p>
    </div>
  );
}
