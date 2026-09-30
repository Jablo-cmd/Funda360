import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useToast } from '@/components/ui/toast/useToast';
import { useSchool } from '@/features/school/hooks/useSchool';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { learningService } from '@/features/learning/services/learningService';
import { useLoad } from '@/features/learning/hooks/useLoad';

const selectClass =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary';

/** Academic managers choose which curriculum the school follows and connect their own grades and subjects to it. */
export function LearningSetupPage() {
  const { school } = useSchool();
  const { showToast } = useToast();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const status = useLoad(
    () => learningService.getSetupStatus(school?.id ?? ''),
    `setup:${school?.id}:${version}`,
    Boolean(school),
  );

  if (!school)
    return (
      <PageContainer>
        <NoActiveSchoolNotice resource="curriculum setup" />
      </PageContainer>
    );
  const setup = status.data;
  const adoptedVersions = (setup?.versions ?? []).filter((v) => v.adopted);

  async function run(label: string, action: () => Promise<void>, success: string) {
    setBusy(label);
    setActionError(null);
    try {
      await action();
      showToast(success, { variant: 'success' });
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'That did not save. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Curriculum setup"
        description="Choose the curriculum your school follows, then connect your grades and subjects to it so teachers see the right topics."
        action={
          <Link
            to="/learning"
            className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-strong px-4 text-sm font-semibold text-content-primary hover:bg-surface-sunken lg:w-auto"
          >
            Back to Learning
          </Link>
        }
      />
      <ErrorAlert message={status.error ?? actionError} />
      {status.isLoading && !setup ? (
        <LoadingBlock label="Loading curriculum setup…" />
      ) : setup ? (
        <>
          <Card title="1. Curriculum">
            {setup.versions.length === 0 ? (
              <p className="text-sm text-content-secondary">
                No curriculum has been published yet. Funda360 publishes curriculum after it has
                been reviewed. Please check back soon.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {setup.versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-content-primary">
                        {v.name}
                      </p>
                      <p className="text-xs text-content-tertiary">{v.code}</p>
                    </div>
                    {v.adopted ? (
                      <span className="rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-500">
                        ✓ In use
                      </span>
                    ) : (
                      <div className="w-full sm:w-auto sm:min-w-[9rem]">
                        <Button
                          type="button"
                          isLoading={busy === `adopt:${v.id}`}
                          onClick={() =>
                            void run(
                              `adopt:${v.id}`,
                              () => learningService.adoptVersion(school.id, v.id),
                              'Curriculum adopted.',
                            )
                          }
                        >
                          Use this curriculum
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {adoptedVersions.length > 0 && (
            <>
              <Card title="2. Connect your grades">
                <ul className="flex flex-col gap-3">
                  {setup.schoolGrades.map((grade) => (
                    <li key={grade.id} className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`grade-${grade.id}`}
                        className="text-sm font-medium text-content-primary"
                      >
                        {grade.name}
                      </label>
                      <select
                        id={`grade-${grade.id}`}
                        className={selectClass}
                        value={
                          setup.gradeMaps.find(
                            (m) =>
                              m.schoolGradeId === grade.id &&
                              adoptedVersions.some((v) => v.id === m.curriculumVersionId),
                          )?.curriculumGradeId ?? ''
                        }
                        onChange={(e) => {
                          const target = setup.curriculumGrades.find(
                            (g) => g.id === e.target.value,
                          );
                          if (target)
                            void run(
                              `grade:${grade.id}`,
                              () =>
                                learningService.saveGradeMap(
                                  school.id,
                                  grade.id,
                                  target.versionId,
                                  target.id,
                                ),
                              `${grade.name} connected.`,
                            );
                        }}
                        disabled={busy === `grade:${grade.id}`}
                      >
                        <option value="">Not connected</option>
                        {setup.curriculumGrades
                          .filter((g) => adoptedVersions.some((v) => v.id === g.versionId))
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="3. Connect your subjects">
                <ul className="flex flex-col gap-3">
                  {setup.schoolSubjects.map((subject) => (
                    <li key={subject.id} className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`subject-${subject.id}`}
                        className="text-sm font-medium text-content-primary"
                      >
                        {subject.name}
                      </label>
                      <select
                        id={`subject-${subject.id}`}
                        className={selectClass}
                        value={
                          setup.subjectMaps.find(
                            (m) =>
                              m.schoolSubjectId === subject.id &&
                              adoptedVersions.some((v) => v.id === m.curriculumVersionId),
                          )?.curriculumSubjectId ?? ''
                        }
                        onChange={(e) => {
                          const target = setup.curriculumSubjects.find(
                            (s) => s.id === e.target.value,
                          );
                          if (target)
                            void run(
                              `subject:${subject.id}`,
                              () =>
                                learningService.saveSubjectMap(
                                  school.id,
                                  subject.id,
                                  target.versionId,
                                  target.id,
                                ),
                              `${subject.name} connected.`,
                            );
                        }}
                        disabled={busy === `subject:${subject.id}`}
                      >
                        <option value="">Not connected</option>
                        {setup.curriculumSubjects
                          .filter((s) => adoptedVersions.some((v) => v.id === s.versionId))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </>
      ) : null}
    </PageContainer>
  );
}
