import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { gradeService } from '@/features/academic/services/gradeService';
import { GradesTable } from '@/features/academic/components/GradesTable';
import { GradeFormModal } from '@/features/academic/components/GradeFormModal';
import type { Grade } from '@/features/academic/types/academic.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

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
      setActionError(getDbErrorMessage(err, 'Failed to update grade.'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Grades"
        description="Manage the grade catalogue for your school."
        action={
          canManage && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={openCreate}>
                Add grade
              </Button>
            </div>
          )
        }
      />

      <label className="flex w-fit items-center gap-2 text-sm text-content-secondary">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
          className="focus-ring h-4 w-4 rounded border-border-strong"
        />
        Show archived grades
      </label>

      <ErrorAlert message={error ?? actionError} />

      {isLoading ? (
        <LoadingBlock label="Loading grades…" />
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
    </PageContainer>
  );
}
