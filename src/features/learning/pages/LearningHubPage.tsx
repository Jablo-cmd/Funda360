import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TeachingResourceRow } from '@/lib/database.types';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Card } from '@/components/ui/Card';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useToast } from '@/components/ui/toast/useToast';
import { useAuth } from '@/features/auth/context/authContext';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { learningService } from '@/features/learning/services/learningService';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { ToolkitPanel } from '@/features/learning/components/ToolkitPanel';
import { ResourceViewer } from '@/features/learning/components/ResourceViewer';
import { AssignModal } from '@/features/learning/components/AssignModal';
import { RecordResultsModal } from '@/features/learning/components/RecordResultsModal';
import { ClassProgressPanel } from '@/features/learning/components/ClassProgressPanel';
import type { AssessmentView, LessonView } from '@/features/learning/types/learning.types';
import { DIFFICULTY_LABEL, formatMinutes } from '@/features/learning/utils/toolkit';

type AssignTarget =
  { kind: 'lesson'; item: LessonView } | { kind: 'assessment'; item: AssessmentView };

const selectClass =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary';

export function LearningHubPage() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { can } = usePermissions();
  const { showToast } = useToast();
  const canManage = can('academic.manage');

  const [contextKey, setContextKey] = useState<string | null>(null);
  const [pickedTopicId, setPickedTopicId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [openResource, setOpenResource] = useState<TeachingResourceRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [recordFor, setRecordFor] = useState<AssessmentView | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const contexts = useLoad(
    () => learningService.listTeachingContexts(user?.id ?? '', school?.id ?? '', canManage),
    `contexts:${user?.id}:${school?.id}:${canManage}`,
    Boolean(user && school),
  );
  const context = contexts.data?.find((c) => c.key === contextKey) ?? contexts.data?.[0] ?? null;

  const topics = useLoad(
    () => learningService.listTopics(context!),
    `topics:${context?.key}`,
    Boolean(context),
  );
  const current = useLoad(
    () => learningService.getCurrentTopicId(context!.classId, context!.schoolSubjectId),
    `current:${context?.key}:${currentVersion}`,
    Boolean(context),
  );
  const topicId = pickedTopicId ?? current.data ?? topics.data?.[0]?.id ?? null;

  const learning = useLoad(
    () => learningService.getTopicLearning(topicId as string),
    `learning:${topicId}`,
    Boolean(topicId),
  );
  const lessons = learning.data?.lessons ?? [];
  const lesson = lessons.find((l) => l.id === lessonId) ?? lessons[0] ?? null;
  const objectives = learning.data?.objectives ?? [];
  const allResources = useMemo(() => learning.data?.resources ?? [], [learning.data]);
  const lessonResources = useMemo(
    () => (lesson ? allResources.filter((r) => lesson.resourceIds.includes(r.id)) : allResources),
    [lesson, allResources],
  );
  const assessments = (learning.data?.assessments ?? []).filter(
    (a) => !lesson || a.lesson_id === lesson.id || a.lesson_id === null,
  );

  // Learners for the results form come from the class progress list of the first objective (every enrolled learner is listed).
  const roster = useLoad(
    () => learningService.getClassProgress(context!.classId, objectives[0]!.id),
    `roster:${context?.classId}:${objectives[0]?.id}`,
    Boolean(context && objectives.length > 0 && recordFor),
  );

  if (!school)
    return (
      <PageContainer>
        <NoActiveSchoolNotice resource="learning" />
      </PageContainer>
    );

  async function chooseTopic(id: string) {
    if (!context) return;
    setActionError(null);
    setPickedTopicId(id);
    setLessonId(null);
    try {
      await learningService.setCurrentTopic(context.classId, context.schoolSubjectId, id);
      setCurrentVersion((v) => v + 1);
      showToast('Current topic updated for this class.', { variant: 'success' });
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Could not change the current topic.'));
    }
  }

  async function assign(input: { instructions: string; dueAt: string | null }) {
    if (!context || !assignTarget) return;
    try {
      await learningService.assignLearning({
        classId: context.classId,
        schoolSubjectId: context.schoolSubjectId,
        lessonId: assignTarget.kind === 'lesson' ? assignTarget.item.id : undefined,
        assessmentId: assignTarget.kind === 'assessment' ? assignTarget.item.id : undefined,
        instructions: input.instructions || undefined,
        dueAt: input.dueAt,
      });
      showToast(`Assigned to ${context.className}.`, { variant: 'success' });
    } catch (err) {
      throw new Error(getDbErrorMessage(err, 'Could not assign this.'));
    }
  }

  async function saveResults(entries: Array<{ learnerId: string; score: number }>) {
    if (!recordFor) return { saved: 0, failed: [] as string[] };
    const names = new Map(
      (roster.data ?? []).map((r) => [r.learner_id, `${r.first_name} ${r.last_name}`]),
    );
    let saved = 0;
    const failed: string[] = [];
    for (const entry of entries) {
      try {
        await learningService.recordResult({
          learnerId: entry.learnerId,
          assessmentId: recordFor.id,
          score: entry.score,
        });
        saved += 1;
      } catch {
        failed.push(names.get(entry.learnerId) ?? 'a learner');
      }
    }
    if (saved > 0) {
      setRefreshKey((k) => k + 1);
      showToast(`Saved ${saved} result${saved === 1 ? '' : 's'}.`, { variant: 'success' });
    }
    return { saved, failed };
  }

  const loadError = contexts.error ?? topics.error ?? learning.error;

  return (
    <PageContainer>
      <PageHeader
        title="Learning"
        description="Teach from the curriculum: choose your topic, use the toolkit, then see who understands and who needs help."
        action={
          canManage ? (
            <Link
              to="/learning/setup"
              className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-strong px-4 text-sm font-semibold text-content-primary hover:bg-surface-sunken lg:w-auto"
            >
              Curriculum setup
            </Link>
          ) : undefined
        }
      />

      <ErrorAlert message={loadError ?? actionError} />

      {contexts.isLoading ? (
        <LoadingBlock label="Loading your classes…" />
      ) : !context ? (
        <section className="rounded-card border border-dashed border-border bg-surface-raised px-4 py-10 text-center">
          <h2 className="text-base font-semibold text-content-primary">
            Nothing to teach from yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-content-secondary">
            {canManage
              ? 'Choose the curriculum your school follows and connect your grades and subjects to it.'
              : 'Your school has not connected the curriculum to your classes yet, or you have no classes assigned. Ask your school administrator.'}
          </p>
          {canManage && (
            <Link
              to="/learning/setup"
              className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              Set up the curriculum
            </Link>
          )}
        </section>
      ) : (
        <>
          <Card title="What am I teaching?">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="learning-class"
                  className="text-sm font-medium text-content-primary"
                >
                  Class and subject
                </label>
                <select
                  id="learning-class"
                  className={selectClass}
                  value={context.key}
                  onChange={(e) => {
                    setContextKey(e.target.value);
                    setPickedTopicId(null);
                    setLessonId(null);
                  }}
                >
                  {(contexts.data ?? []).map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.className} · {c.subjectName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="learning-topic"
                  className="text-sm font-medium text-content-primary"
                >
                  Current topic
                </label>
                <select
                  id="learning-topic"
                  className={selectClass}
                  value={topicId ?? ''}
                  onChange={(e) => void chooseTopic(e.target.value)}
                  disabled={topics.isLoading || (topics.data ?? []).length === 0}
                >
                  {(topics.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      Term {t.termNumber} · {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!current.isLoading && !current.data && topicId && (
              <p className="text-xs text-content-tertiary">
                Choose a topic above to set it as this class&apos;s current topic.
              </p>
            )}
            {objectives.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium text-content-primary">
                  By the end of this topic, learners can:
                </h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-content-secondary">
                  {objectives.map((o) => (
                    <li key={o.id} className="break-words">
                      {o.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {learning.isLoading ? (
            <LoadingBlock label="Loading lessons and resources…" />
          ) : lessons.length === 0 ? (
            <section className="rounded-card border border-dashed border-border bg-surface-raised px-4 py-8 text-center">
              <h2 className="text-base font-semibold text-content-primary">
                No lessons for this topic yet
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-content-secondary">
                The learning objectives are above. Lessons and resources for this topic are still
                being prepared and reviewed.
              </p>
            </section>
          ) : (
            <>
              <Card title="Lesson">
                {lessons.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="learning-lesson"
                      className="text-sm font-medium text-content-primary"
                    >
                      Choose a lesson
                    </label>
                    <select
                      id="learning-lesson"
                      className={selectClass}
                      value={lesson?.id ?? ''}
                      onChange={(e) => setLessonId(e.target.value)}
                    >
                      {lessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {lesson && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="break-words text-lg font-semibold text-content-primary">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-content-tertiary">
                        {[
                          formatMinutes(lesson.estimated_minutes),
                          DIFFICULTY_LABEL[lesson.difficulty],
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {lesson.description && (
                      <p className="break-words text-sm text-content-secondary">
                        {lesson.description}
                      </p>
                    )}
                    {lesson.teacher_notes && (
                      <p className="break-words rounded-md bg-surface-sunken px-3 py-2 text-sm text-content-primary">
                        <strong>Teacher note: </strong>
                        {lesson.teacher_notes}
                      </p>
                    )}
                    {lesson.activities.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-sm font-medium text-content-primary">
                          Class activities
                        </h4>
                        <ul className="flex flex-col gap-1.5 text-sm text-content-secondary">
                          {lesson.activities.map((a) => (
                            <li key={a.id} className="break-words">
                              <strong className="text-content-primary">{a.title}</strong>
                              {' — '}
                              {a.instructions}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="sm:w-auto sm:max-w-xs">
                      <button
                        type="button"
                        onClick={() => setAssignTarget({ kind: 'lesson', item: lesson })}
                        className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-500"
                      >
                        Assign this lesson to {context.className}
                      </button>
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Teacher toolkit">
                <ToolkitPanel
                  key={lesson?.id ?? 'all'}
                  resources={lessonResources}
                  onOpen={setOpenResource}
                />
              </Card>

              {assessments.length > 0 && (
                <Card title="Check understanding">
                  <ul className="flex flex-col gap-3">
                    {assessments.map((a) => {
                      const total = a.questions.reduce((sum, q) => sum + q.marks, 0);
                      return (
                        <li
                          key={a.id}
                          className="flex flex-col gap-2 rounded-card border border-border p-4"
                        >
                          <div>
                            <h3 className="break-words text-base font-semibold text-content-primary">
                              {a.title}
                            </h3>
                            <p className="text-xs text-content-tertiary">
                              {a.questions.length} questions · {total} marks
                              {formatMinutes(a.estimated_minutes)
                                ? ` · ${formatMinutes(a.estimated_minutes)}`
                                : ''}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => setAssignTarget({ kind: 'assessment', item: a })}
                              className="focus-ring min-h-11 rounded-md border border-border-strong px-4 text-sm font-semibold text-content-primary hover:bg-surface-sunken"
                            >
                              Assign quick check
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecordFor(a)}
                              className="focus-ring min-h-11 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500"
                            >
                              Record results
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}

              <Card title="Who understands? Who needs help?">
                <ClassProgressPanel
                  classId={context.classId}
                  objectives={objectives}
                  resources={allResources}
                  refreshKey={refreshKey}
                />
              </Card>
            </>
          )}
        </>
      )}

      <ResourceViewer resource={openResource} onClose={() => setOpenResource(null)} />
      <AssignModal
        isOpen={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        itemTitle={assignTarget?.item.title ?? ''}
        className={context?.className ?? 'your class'}
        onAssign={assign}
      />
      <RecordResultsModal
        isOpen={recordFor !== null}
        onClose={() => setRecordFor(null)}
        assessmentTitle={recordFor?.title ?? ''}
        maxScore={recordFor ? recordFor.questions.reduce((sum, q) => sum + q.marks, 0) : 0}
        learners={(roster.data ?? []).map((r) => ({
          id: r.learner_id,
          name: `${r.first_name} ${r.last_name}`,
          learnerNumber: r.learner_number,
        }))}
        onSave={saveResults}
      />
    </PageContainer>
  );
}
