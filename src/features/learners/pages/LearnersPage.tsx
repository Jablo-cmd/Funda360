import { useState } from 'react';
import { Button } from '@/components/ui/Button';
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
  const { learners, totalCount, page, pageSize, isLoading, error, filters, setFilters, setPage, refetch } =
    useLearnersList(school?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Learners</h1>
          <p className="mt-1 text-sm text-content-secondary">Manage the learner directory for your school.</p>
        </div>
        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
              Add learner
            </Button>
          </div>
        )}
      </div>

      <LearnersFiltersBar filters={filters} onChange={setFilters} />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading learners…</span>
        </div>
      ) : (
        <>
          <LearnersTable learners={learners} canViewSensitive={canViewSensitive} />
          <LearnersPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
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
    </div>
  );
}
