import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { classService } from '@/features/academic/services/classService';
import { ClassesTable } from '@/features/academic/components/ClassesTable';
import { ClassFormModal } from '@/features/academic/components/ClassFormModal';
import type { Class } from '@/features/academic/types/academic.types';

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
      setActionError(err instanceof Error ? err.message : 'Failed to update class.');
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Classes</h1>
          <p className="mt-1 text-sm text-content-secondary">Manage class sections and their capacity.</p>
        </div>
        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={openCreate} disabled={grades.filter((g) => g.active).length === 0}>
              Add class
            </Button>
          </div>
        )}
      </div>

      {canManage && grades.filter((g) => g.active).length === 0 && (
        <p className="text-sm text-content-tertiary">Add an active grade before creating classes.</p>
      )}

      <label className="flex w-fit items-center gap-2 text-sm text-content-secondary">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
          className="focus-ring h-4 w-4 rounded border-border-strong"
        />
        Show archived classes
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
          <span className="sr-only">Loading classes…</span>
        </div>
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
    </div>
  );
}
