import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { SearchIcon } from '@/components/ui/icons';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAlumniList } from '@/features/learners/hooks/useAlumniList';
import { LearnersTable } from '@/features/learners/components/LearnersTable';
import { LearnersPagination } from '@/features/learners/components/LearnersPagination';

/** A read-only registry of graduated learners (FND-SIS-008) — reuses the same LearnersTable staff already know from the main directory, filtered to status: 'graduated' and locked there (see useAlumniList's own doc comment). No create/import actions: alumni only ever arrive at this list through the normal status lifecycle, never created directly here. */
export function AlumniPage() {
  const { can } = usePermissions();
  const canViewSensitive = can('learner.view_sensitive');
  const { school } = useSchool();
  const { alumni, totalCount, page, pageSize, isLoading, error, search, setSearch, setPage } = useAlumniList(school?.id);

  return (
    <PageContainer>
      <PageHeader title="Alumni" description="Learners who have graduated from your school." />

      {school && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, learner # or admission #…"
            aria-label="Search alumni"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3.5 text-sm text-content-primary placeholder:text-content-tertiary sm:max-w-sm"
          />
        </div>
      )}

      <ErrorAlert message={error} />

      {!school ? (
        <NoActiveSchoolNotice resource="the alumni registry" />
      ) : isLoading ? (
        <LoadingBlock label="Loading alumni…" />
      ) : (
        <>
          <LearnersTable learners={alumni} canViewSensitive={canViewSensitive} />
          <LearnersPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </PageContainer>
  );
}
