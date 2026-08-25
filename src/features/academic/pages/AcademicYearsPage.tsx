import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { academicYearService } from '@/features/academic/services/academicYearService';
import { AcademicYearsTable } from '@/features/academic/components/AcademicYearsTable';
import { AcademicYearFormModal } from '@/features/academic/components/AcademicYearFormModal';
import type { AcademicYear } from '@/features/academic/types/academic.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function AcademicYearsPage() {
  const { can } = usePermissions();
  const canManage = can('academic.manage');
  const { school } = useSchool();
  const { academicYears, loading, error, refresh } = useAcademic();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return <FullScreenSpinner label="Loading academic years…" />;
  }

  if (!school) {
    return (
      <PageContainer>
        <PageHeader
          title="Academic Years"
          description="Only one academic year can be active at a time."
        />
        <NoActiveSchoolNotice resource="academic years" />
      </PageContainer>
    );
  }

  const openCreate = () => {
    setEditingYear(null);
    setIsFormOpen(true);
  };

  const openEdit = (year: AcademicYear) => {
    setEditingYear(year);
    setIsFormOpen(true);
  };

  const handleActivate = async (year: AcademicYear) => {
    setActionError(null);
    setActivatingId(year.id);
    try {
      await academicYearService.setActiveAcademicYear(year.id);
      await refresh();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to activate academic year.'));
    } finally {
      setActivatingId(null);
    }
  };

  const handleArchive = async (year: AcademicYear) => {
    setActionError(null);
    try {
      await academicYearService.archiveAcademicYear(year.id);
      await refresh();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to archive academic year.'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Academic Years"
        description="Only one academic year can be active at a time."
        action={
          canManage && (
            <div className="w-full sm:w-auto sm:min-w-[10rem]">
              <Button type="button" onClick={openCreate}>
                Add academic year
              </Button>
            </div>
          )
        }
      />

      <ErrorAlert message={error ?? actionError} />

      <AcademicYearsTable
        years={academicYears}
        canManage={canManage}
        onEdit={openEdit}
        onActivate={(year) => void handleActivate(year)}
        onArchive={(year) => void handleArchive(year)}
        activatingId={activatingId}
      />

      <AcademicYearFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        schoolId={school.id}
        year={editingYear}
        onSaved={() => void refresh()}
      />
    </PageContainer>
  );
}
