import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { useAssessmentReport } from '@/features/reports/hooks/useAssessmentReport';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';

export function AssessmentReportPage() {
  const { can } = usePermissions();
  const canView = can('assessment.view');
  const { school } = useSchool();
  const { academicYears, currentAcademicYear } = useAcademic();
  const { classes } = useClasses(canView ? school?.id : undefined);
  const { subjects } = useSubjects(canView ? school?.id : undefined);

  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  useEffect(() => {
    if (!academicYearId && currentAcademicYear) setAcademicYearId(currentAcademicYear.id);
  }, [academicYearId, currentAcademicYear]);

  const { terms } = useTerms(canView ? academicYearId || undefined : undefined);

  const classesById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const termsById = useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const academicYearsById = useMemo(() => Object.fromEntries(academicYears.map((y) => [y.id, y])), [academicYears]);

  const context = useMemo(
    () => ({ classesById, subjectsById, termsById, academicYearsById }),
    [classesById, subjectsById, termsById, academicYearsById],
  );

  const { data, isLoading, error } = useAssessmentReport(
    canView ? school?.id : undefined,
    { classId: classId || undefined, subjectId: subjectId || undefined, termId: termId || undefined, academicYearId: academicYearId || undefined },
    context,
  );

  if (!canView) {
    return (
      <PageContainer>
        <ErrorAlert message="You don't have permission to view this report." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Assessment report" description="Class performance and individual assessment results." />

      <div className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-raised p-4 sm:grid-cols-4">
        <div>
          <label htmlFor="ar-filter-year" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Academic year
          </label>
          <select
            id="ar-filter-year"
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
          <label htmlFor="ar-filter-term" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Term
          </label>
          <select
            id="ar-filter-term"
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
          <label htmlFor="ar-filter-class" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Class
          </label>
          <select
            id="ar-filter-class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          >
            <option value="">All classes</option>
            {classes.filter((c) => c.active).map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ar-filter-subject" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Subject
          </label>
          <select
            id="ar-filter-subject"
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

      <ErrorAlert message={error} />

      {isLoading ? (
        <LoadingBlock label="Loading assessment report…" />
      ) : !data || data.classPerformanceRows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No assessment data matches these filters yet.
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-content-primary">Class performance summary</h2>
              <ExportCsvButton
                rows={data.classPerformanceRows}
                columns={[
                  { key: 'className', header: 'Class' },
                  { key: 'subjectName', header: 'Subject' },
                  { key: 'assessmentTitle', header: 'Assessment' },
                  { key: 'numberAssessed', header: 'Assessed' },
                  { key: 'averagePercentage', header: 'Average %' },
                  { key: 'highestMark', header: 'Highest' },
                  { key: 'lowestMark', header: 'Lowest' },
                ]}
                filename="class-performance-summary.csv"
              />
            </div>
            <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                    <th scope="col" className="px-4 py-3 font-medium">Class</th>
                    <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                    <th scope="col" className="px-4 py-3 font-medium">Assessment</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Assessed</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Average</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Highest</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Lowest</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classPerformanceRows.map((row) => (
                    <tr key={row.assessmentId} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-content-primary">{row.className}</td>
                      <td className="px-4 py-3 text-content-secondary">{row.subjectName}</td>
                      <td className="px-4 py-3 text-content-secondary">{row.assessmentTitle}</td>
                      <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.numberAssessed}</td>
                      <td className="px-4 py-3 text-right font-mono text-content-secondary">
                        {row.averagePercentage === null ? '—' : `${row.averagePercentage}%`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-content-secondary">
                        {row.highestMark === null ? '—' : `${row.highestMark}/${row.maxMark}`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-content-secondary">
                        {row.lowestMark === null ? '—' : `${row.lowestMark}/${row.maxMark}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-content-primary">Assessment results</h2>
              <ExportCsvButton
                rows={data.resultRows}
                columns={[
                  { key: 'learnerName', header: 'Learner' },
                  { key: 'className', header: 'Class' },
                  { key: 'subjectName', header: 'Subject' },
                  { key: 'assessmentTitle', header: 'Assessment' },
                  { key: 'mark', header: 'Mark' },
                  { key: 'maxMark', header: 'Max mark' },
                  { key: 'percentage', header: 'Percentage' },
                  { key: 'termName', header: 'Term' },
                  { key: 'academicYearName', header: 'Academic year' },
                ]}
                filename="assessment-results.csv"
              />
            </div>
            {data.resultRows.length === 0 ? (
              <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
                No marks have been entered for these assessments yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                      <th scope="col" className="px-4 py-3 font-medium">Learner</th>
                      <th scope="col" className="px-4 py-3 font-medium">Class</th>
                      <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                      <th scope="col" className="px-4 py-3 font-medium">Assessment</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Mark</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.resultRows.map((row, index) => (
                      <tr key={`${row.assessmentId}-${row.learnerId}-${index}`} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium text-content-primary">{row.learnerName}</td>
                        <td className="px-4 py-3 text-content-secondary">{row.className}</td>
                        <td className="px-4 py-3 text-content-secondary">{row.subjectName}</td>
                        <td className="px-4 py-3 text-content-secondary">{row.assessmentTitle}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">
                          {row.mark}/{row.maxMark}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
