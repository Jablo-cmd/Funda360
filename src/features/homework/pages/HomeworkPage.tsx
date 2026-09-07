import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useAssignments } from '@/features/homework/hooks/useAssignments';
import { formatDue } from '@/features/homework/utils/homeworkDisplay';
import { CreateAssignmentModal } from '@/features/homework/components/CreateAssignmentModal';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-surface-sunken text-content-tertiary',
  published: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  closed: 'bg-surface-sunken text-content-secondary',
};

export function HomeworkPage() {
  const { school } = useSchool();
  const schoolId = school?.id ?? null;
  const { currentAcademicYear } = useAcademic();
  const navigate = useNavigate();
  const { classes } = useClasses(schoolId ?? undefined);
  const { subjects } = useSubjects(schoolId ?? undefined);
  const [classId, setClassId] = useState('');
  const [isCreateOpen, setCreateOpen] = useState(false);

  const filters = useMemo(() => ({ classId: classId || undefined }), [classId]);
  const { assignments, isLoading, error, refetch } = useAssignments(schoolId ?? undefined, filters);

  if (!schoolId) {
    return (
      <PageContainer>
        <PageHeader title="Homework" />
        <NoActiveSchoolNotice resource="homework" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Homework"
        description="Assignments you have set, and how each class is getting on."
        action={
          <div className="w-full sm:w-auto sm:min-w-[10rem]">
            <Button type="button" onClick={() => setCreateOpen(true)}>
              New assignment
            </Button>
          </div>
        }
      />

      <ErrorAlert message={error} />

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-content-primary">Class</span>
          <select
            className="h-11 rounded-md border border-border-strong bg-surface-raised px-3 text-sm"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <LoadingBlock label="Loading assignments…" />
      ) : assignments.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No assignments yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => navigate(`/homework/${a.id}`)}
                className="focus-ring flex w-full flex-col gap-1 rounded-card border border-border bg-surface-raised px-4 py-3 text-left hover:bg-surface-sunken"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-content-primary">{a.title}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[a.status] ?? ''}`}>
                    {a.status}
                  </span>
                </div>
                <span className="text-sm text-content-secondary">
                  {a.className ?? 'Class'} · {a.subjectName ?? 'Subject'} · {formatDue(a.dueAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isCreateOpen && (
        <CreateAssignmentModal
          schoolId={schoolId}
          academicYearId={currentAcademicYear?.id ?? null}
          classes={classes}
          subjects={subjects}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            void refetch();
            navigate(`/homework/${id}`);
          }}
        />
      )}
    </PageContainer>
  );
}
