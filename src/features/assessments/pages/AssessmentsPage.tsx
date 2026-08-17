import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { useMyTeachingAssignments } from '@/features/teaching/hooks/useMyTeachingAssignments';
import { useAssessments } from '@/features/assessments/hooks/useAssessments';
import { AssessmentsTable } from '@/features/assessments/components/AssessmentsTable';
import { AssessmentFormModal } from '@/features/assessments/components/AssessmentFormModal';
import type { Assessment } from '@/features/assessments/types/assessment.types';

export function AssessmentsPage() {
  const { can } = usePermissions();
  const canManageAny = can('academic.manage');
  const { school } = useSchool();
  const { academicYears, currentAcademicYear } = useAcademic();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const myAssignments = useMyTeachingAssignments();

  const [searchParams, setSearchParams] = useSearchParams();
  const presetClassId = searchParams.get('classId') ?? '';

  const [academicYearId, setAcademicYearId] = useState(currentAcademicYear?.id ?? '');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState(presetClassId);
  const [subjectId, setSubjectId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!academicYearId && currentAcademicYear) setAcademicYearId(currentAcademicYear.id);
  }, [academicYearId, currentAcademicYear]);

  const { terms } = useTerms(academicYearId || undefined);

  const myClassIds = useMemo(() => new Set(myAssignments.data.map((a) => a.classId)), [myAssignments.data]);
  const availableClasses = useMemo(
    () =>
      classes
        .filter((c) => c.active && (canManageAny || myClassIds.has(c.id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [classes, canManageAny, myClassIds],
  );

  const { assessments, isLoading, error } = useAssessments(school?.id, {
    classId: classId || undefined,
    subjectId: subjectId || undefined,
    termId: termId || undefined,
    academicYearId: academicYearId || undefined,
  });

  const classesById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const termsById = useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);

  const handleClassFilterChange = (value: string) => {
    setClassId(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('classId', value);
    else next.delete('classId');
    setSearchParams(next, { replace: true });
  };

  const handleCreated = (assessment: Assessment) => {
    setClassId(assessment.classId);
    setAcademicYearId(assessment.academicYearId);
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Assessments</h1>
          <p className="mt-0.5 text-sm text-content-secondary">Tests, assignments and exams across your classes.</p>
        </div>
        {(canManageAny || availableClasses.length > 0) && (
          <div className="w-full sm:w-auto sm:min-w-[10rem]">
            <Button type="button" onClick={() => setIsFormOpen(true)}>
              Create assessment
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-raised p-4 sm:grid-cols-4">
        <div>
          <label htmlFor="filter-year" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Academic year
          </label>
          <select
            id="filter-year"
            value={academicYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          >
            <option value="">All years</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-term" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Term
          </label>
          <select
            id="filter-term"
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          >
            <option value="">All terms</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-class" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Class
          </label>
          <select
            id="filter-class"
            value={classId}
            onChange={(event) => handleClassFilterChange(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          >
            <option value="">{canManageAny ? 'All classes' : 'My classes'}</option>
            {(canManageAny ? classes.filter((c) => c.active) : availableClasses).map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-subject" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Subject
          </label>
          <select
            id="filter-subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          >
            <option value="">All subjects</option>
            {subjects.filter((s) => s.active).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading assessments…</span>
        </div>
      ) : (
        <AssessmentsTable
          assessments={assessments}
          classesById={classesById}
          subjectsById={subjectsById}
          termsById={termsById}
          showClassColumn={!classId}
        />
      )}

      {school && (
        <AssessmentFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          academicYears={academicYears}
          terms={terms}
          classes={classes}
          subjects={subjects}
          availableClasses={canManageAny ? classes.filter((c) => c.active) : availableClasses}
          myAssignments={myAssignments.data}
          canManageAny={canManageAny}
          initialClassId={classId || undefined}
          onSaved={handleCreated}
        />
      )}
    </div>
  );
}
