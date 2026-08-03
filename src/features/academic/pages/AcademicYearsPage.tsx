import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { academicYearService } from '@/features/academic/services/academicYearService';
import { AcademicYearsTable } from '@/features/academic/components/AcademicYearsTable';
import { AcademicYearFormModal } from '@/features/academic/components/AcademicYearFormModal';
import type { AcademicYear } from '@/features/academic/types/academic.types';

export function AcademicYearsPage() {
  const { can } = usePermissions();
  const canManage = can('academic.manage');
  const { school } = useSchool();
  const { academicYears, loading, error, refresh } = useAcademic();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading || !school) {
    return <FullScreenSpinner label="Loading academic years…" />;
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
      setActionError(err instanceof Error ? err.message : 'Failed to activate academic year.');
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
      setActionError(err instanceof Error ? err.message : 'Failed to archive academic year.');
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Academic Years</h1>
          <p className="mt-1 text-sm text-content-secondary">Only one academic year can be active at a time.</p>
        </div>
        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[10rem]">
            <Button type="button" onClick={openCreate}>
              Add academic year
            </Button>
          </div>
        )}
      </div>

      {(error ?? actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error ?? actionError}
        </div>
      )}

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
    </div>
  );
}
