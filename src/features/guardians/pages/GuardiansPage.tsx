import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useGuardiansList } from '@/features/guardians/hooks/useGuardiansList';
import { GuardiansFiltersBar } from '@/features/guardians/components/GuardiansFiltersBar';
import { GuardiansTable } from '@/features/guardians/components/GuardiansTable';
import { GuardiansPagination } from '@/features/guardians/components/GuardiansPagination';
import { CreateGuardianModal } from '@/features/guardians/components/CreateGuardianModal';

export function GuardiansPage() {
  const { can } = usePermissions();
  const canManage = can('guardian.manage');
  const { school } = useSchool();
  const { guardians, totalCount, page, pageSize, isLoading, error, filters, setFilters, setPage, refetch } =
    useGuardiansList(school?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Guardians"
        description="Manage parents and guardians, and their relationships to learners."
        action={
          canManage &&
          school && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={() => setIsCreateOpen(true)}>
                Add guardian
              </Button>
            </div>
          )
        }
      />

      {school && <GuardiansFiltersBar filters={filters} onChange={setFilters} />}

      <ErrorAlert message={error} />

      {!school ? (
        <NoActiveSchoolNotice resource="guardians" />
      ) : isLoading ? (
        <LoadingBlock label="Loading guardians…" />
      ) : (
        <>
          <GuardiansTable guardians={guardians} />
          <GuardiansPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}

      {school && (
        <CreateGuardianModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSaved={() => void refetch()} />
      )}
    </PageContainer>
  );
}
