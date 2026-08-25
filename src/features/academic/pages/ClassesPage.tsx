import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { classService } from '@/features/academic/services/classService';
import { ClassesTable } from '@/features/academic/components/ClassesTable';
import { ClassFormModal } from '@/features/academic/components/ClassFormModal';
import type { Class } from '@/features/academic/types/academic.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function ClassesPage() {
  const { can } = usePermissions();
  const canManage = can('academic.manage');
  const { school } = useSchool();
  const { classes, isLoading, error, refetch } = useClasses(school?.id);
  const { grades } = useGrades(school?.id);

  const [showArchived, setShowArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleClasses = showArchived ? classes : classes.filter((classItem) => classItem.active);

  const openCreate = () => {
    setEditingClass(null);
    setIsFormOpen(true);
  };

  const openEdit = (classItem: Class) => {
    setEditingClass(classItem);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (classItem: Class) => {
    setActionError(null);
    try {
      if (classItem.active) {
        await classService.archiveClass(classItem.id);
      } else {
        await classService.restoreClass(classItem.id);
      }
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to update class.'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Classes"
        description="Manage class sections and their capacity."
        action={
          canManage &&
          school && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button
                type="button"
                onClick={openCreate}
                disabled={grades.filter((g) => g.active).length === 0}
              >
                Add class
              </Button>
            </div>
          )
        }
      />

      {canManage && school && grades.filter((g) => g.active).length === 0 && (
        <p className="text-sm text-content-tertiary">
          Add an active grade before creating classes.
        </p>
      )}

      {school && (
        <label className="flex w-fit items-center gap-2 text-sm text-content-secondary">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="focus-ring h-4 w-4 rounded border-border-strong"
          />
          Show archived classes
        </label>
      )}

      <ErrorAlert message={error ?? actionError} />

      {!school ? (
        <NoActiveSchoolNotice resource="classes" />
      ) : isLoading ? (
        <LoadingBlock label="Loading classes…" />
      ) : (
        <ClassesTable
          classes={visibleClasses}
          grades={grades}
          canManage={canManage}
          onEdit={openEdit}
          onToggleActive={(classItem) => void handleToggleActive(classItem)}
        />
      )}

      {school && (
        <ClassFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          grades={grades}
          classItem={editingClass}
          onSaved={() => void refetch()}
        />
      )}
    </PageContainer>
  );
}
