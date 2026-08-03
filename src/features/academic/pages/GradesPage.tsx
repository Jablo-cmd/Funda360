import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { gradeService } from '@/features/academic/services/gradeService';
import { GradesTable } from '@/features/academic/components/GradesTable';
import { GradeFormModal } from '@/features/academic/components/GradeFormModal';
import type { Grade } from '@/features/academic/types/academic.types';

export function GradesPage() {
  const { can } = usePermissions();
  const canManage = can('academic.manage');
  const { school } = useSchool();
  const { grades, isLoading, error, refetch } = useGrades(school?.id);

  const [showArchived, setShowArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleGrades = showArchived ? grades : grades.filter((grade) => grade.active);

  const openCreate = () => {
    setEditingGrade(null);
    setIsFormOpen(true);
  };

  const openEdit = (grade: Grade) => {
    setEditingGrade(grade);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (grade: Grade) => {
    setActionError(null);
    try {
      if (grade.active) {
        await gradeService.archiveGrade(grade.id);
      } else {
        await gradeService.restoreGrade(grade.id);
      }
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update grade.');
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Grades</h1>
          <p className="mt-1 text-sm text-content-secondary">Manage the grade catalogue for your school.</p>
        </div>
        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={openCreate}>
              Add grade
            </Button>
          </div>
        )}
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-content-secondary">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
          className="focus-ring h-4 w-4 rounded border-border-strong"
        />
        Show archived grades
      </label>

      {(error ?? actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error ?? actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading grades…</span>
        </div>
      ) : (
        <GradesTable
          grades={visibleGrades}
          canManage={canManage}
          onEdit={openEdit}
          onToggleActive={(grade) => void handleToggleActive(grade)}
        />
      )}

      {school && (
        <GradeFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          grade={editingGrade}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  );
}
