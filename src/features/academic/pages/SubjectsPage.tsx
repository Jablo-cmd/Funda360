import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SearchIcon } from '@/components/ui/icons';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { subjectService } from '@/features/academic/services/subjectService';
import { SubjectsTable } from '@/features/academic/components/SubjectsTable';
import { SubjectFormModal } from '@/features/academic/components/SubjectFormModal';
import type { Subject } from '@/features/academic/types/academic.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function SubjectsPage() {
  const { can } = usePermissions();
  const canManage = can('academic.manage');
  const { school } = useSchool();
  const { subjects, isLoading, error, refetch } = useSubjects(school?.id);

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleSubjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subjects
      .filter((subject) => showArchived || subject.active)
      .filter(
        (subject) =>
          !term ||
          subject.name.toLowerCase().includes(term) ||
          subject.code?.toLowerCase().includes(term),
      );
  }, [subjects, search, showArchived]);

  const openCreate = () => {
    setEditingSubject(null);
    setIsFormOpen(true);
  };

  const openEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (subject: Subject) => {
    setActionError(null);
    try {
      if (subject.active) {
        await subjectService.archiveSubject(subject.id);
      } else {
        await subjectService.restoreSubject(subject.id);
      }
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to update subject.'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Subjects"
        description="Manage the subject catalogue for your school."
        action={
          canManage && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={openCreate}>
                Add subject
              </Button>
            </div>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or code…"
            aria-label="Search subjects"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3.5 text-sm text-content-primary placeholder:text-content-tertiary"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="focus-ring h-4 w-4 rounded border-border-strong"
          />
          Show archived
        </label>
      </div>

      <ErrorAlert message={error ?? actionError} />

      {isLoading ? (
        <LoadingBlock label="Loading subjects…" />
      ) : (
        <SubjectsTable
          subjects={visibleSubjects}
          canManage={canManage}
          onEdit={openEdit}
          onToggleActive={(subject) => void handleToggleActive(subject)}
        />
      )}

      {school && (
        <SubjectFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          subject={editingSubject}
          onSaved={() => void refetch()}
        />
      )}
    </PageContainer>
  );
}
