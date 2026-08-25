import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useLearnersList } from '@/features/learners/hooks/useLearnersList';
import { LearnersFiltersBar } from '@/features/learners/components/LearnersFiltersBar';
import { LearnersTable } from '@/features/learners/components/LearnersTable';
import { LearnersPagination } from '@/features/learners/components/LearnersPagination';
import { LearnerFormModal } from '@/features/learners/components/LearnerFormModal';

export function LearnersPage() {
  const { can } = usePermissions();
  const canManage = can('learner.manage');
  const canViewSensitive = can('learner.view_sensitive');
  const { school } = useSchool();
  const {
    learners,
    totalCount,
    page,
    pageSize,
    isLoading,
    error,
    filters,
    setFilters,
    setPage,
    refetch,
  } = useLearnersList(school?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Learners"
        description="Manage the learner directory for your school."
        action={
          canManage &&
          school && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={() => setIsCreateOpen(true)}>
                Add learner
              </Button>
            </div>
          )
        }
      />

      {school && <LearnersFiltersBar filters={filters} onChange={setFilters} />}

      <ErrorAlert message={error} />

      {!school ? (
        <NoActiveSchoolNotice resource="learners" />
      ) : isLoading ? (
        <LoadingBlock label="Loading learners…" />
      ) : (
        <>
          <LearnersTable learners={learners} canViewSensitive={canViewSensitive} />
          <LearnersPagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </>
      )}

      {school && (
        <LearnerFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          schoolId={school.id}
          onSaved={() => void refetch()}
        />
      )}
    </PageContainer>
  );
}
