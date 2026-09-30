import { supabase } from '@/lib/supabase';
import type { ClassTopicPlanRow } from '@/lib/database.types';
import type {
  AssessmentView,
  ClassProgressRow,
  LessonView,
  RecommendationView,
  SetupStatus,
  TeachingContext,
  TopicLearning,
  TopicOption,
} from '@/features/learning/types/learning.types';

function fail(error: { message: string; code?: string } | null): void {
  if (error) throw error;
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/**
 * The class + subject combinations this person can teach that are already connected to the school's
 * curriculum (version adopted, grade and subject mapped). Teachers get their own assignments; academic
 * managers get every class.
 */
async function listTeachingContexts(
  userId: string,
  schoolId: string,
  canManage: boolean,
): Promise<TeachingContext[]> {
  const [adoptions, gradeMaps, subjectMaps] = await Promise.all([
    supabase
      .from('school_curriculum_adoptions')
      .select('curriculum_version_id, status')
      .eq('school_id', schoolId)
      .eq('status', 'active'),
    supabase
      .from('school_grade_curriculum_map')
      .select('school_grade_id, curriculum_version_id, curriculum_grade_id')
      .eq('school_id', schoolId),
    supabase
      .from('school_subject_curriculum_map')
      .select('school_subject_id, curriculum_version_id, curriculum_subject_id')
      .eq('school_id', schoolId),
  ]);
  fail(adoptions.error);
  fail(gradeMaps.error);
  fail(subjectMaps.error);
  const adopted = new Set((adoptions.data ?? []).map((a) => a.curriculum_version_id));
  if (adopted.size === 0) return [];

  const gradeByVersion = (gradeId: string) =>
    (gradeMaps.data ?? []).find(
      (m) => m.school_grade_id === gradeId && adopted.has(m.curriculum_version_id),
    );
  const subjectMap = (subjectId: string, versionId: string) =>
    (subjectMaps.data ?? []).find(
      (m) => m.school_subject_id === subjectId && m.curriculum_version_id === versionId,
    );

  const [classesRes, subjectsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade_id, active')
      .eq('school_id', schoolId)
      .eq('active', true),
    supabase
      .from('subjects')
      .select('id, name, active')
      .eq('school_id', schoolId)
      .eq('active', true),
  ]);
  fail(classesRes.error);
  fail(subjectsRes.error);
  const classes = classesRes.data ?? [];
  const subjects = subjectsRes.data ?? [];

  let pairs: Array<{ classId: string; subjectId: string }> = [];
  if (canManage) {
    pairs = classes.flatMap((c) => subjects.map((s) => ({ classId: c.id, subjectId: s.id })));
  } else {
    const assignments = await supabase
      .from('class_teacher_assignments')
      .select('class_id, subject_id, active')
      .eq('teacher_profile_id', userId)
      .eq('active', true);
    fail(assignments.error);
    for (const a of assignments.data ?? []) {
      // A whole-class teacher (no subject) can teach every subject the class is connected to.
      if (a.subject_id) pairs.push({ classId: a.class_id, subjectId: a.subject_id });
      else for (const s of subjects) pairs.push({ classId: a.class_id, subjectId: s.id });
    }
  }

  const contexts: TeachingContext[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const cls = classes.find((c) => c.id === pair.classId);
    const subject = subjects.find((s) => s.id === pair.subjectId);
    if (!cls || !subject) continue;
    const gmap = gradeByVersion(cls.grade_id);
    if (!gmap) continue;
    const smap = subjectMap(subject.id, gmap.curriculum_version_id);
    if (!smap) continue;
    const key = `${cls.id}:${subject.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contexts.push({
      key,
      classId: cls.id,
      className: cls.name,
      schoolSubjectId: subject.id,
      subjectName: subject.name,
      curriculumVersionId: gmap.curriculum_version_id,
      curriculumGradeId: gmap.curriculum_grade_id,
      curriculumSubjectId: smap.curriculum_subject_id,
    });
  }
  return contexts.sort(
    (a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName),
  );
}

async function listTopics(context: TeachingContext): Promise<TopicOption[]> {
  const gs = await supabase
    .from('curriculum_grade_subjects')
    .select('id')
    .eq('version_id', context.curriculumVersionId)
    .eq('grade_id', context.curriculumGradeId)
    .eq('subject_id', context.curriculumSubjectId);
  fail(gs.error);
  const gsIds = (gs.data ?? []).map((g) => g.id);
  if (gsIds.length === 0) return [];
  const terms = await supabase
    .from('curriculum_terms')
    .select('id, term_number')
    .in('grade_subject_id', gsIds);
  fail(terms.error);
  const termNumber = new Map((terms.data ?? []).map((t) => [t.id, t.term_number]));
  if (termNumber.size === 0) return [];
  const topics = await supabase
    .from('curriculum_topics')
    .select('id, code, title, term_id, sort_order, status')
    .in('term_id', [...termNumber.keys()])
    .order('sort_order', { ascending: true });
  fail(topics.error);
  return (topics.data ?? [])
    .filter((t) => t.status !== 'retired')
    .map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      termNumber: termNumber.get(t.term_id) ?? 1,
      sortOrder: t.sort_order,
    }))
    .sort((a, b) => a.termNumber - b.termNumber || a.sortOrder - b.sortOrder);
}

async function getCurrentTopicId(classId: string, schoolSubjectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('class_topic_plans')
    .select('topic_id, status')
    .eq('class_id', classId)
    .eq('school_subject_id', schoolSubjectId)
    .eq('status', 'in_progress')
    .maybeSingle();
  fail(error);
  return (data as Pick<ClassTopicPlanRow, 'topic_id'> | null)?.topic_id ?? null;
}

async function getTopicLearning(topicId: string): Promise<TopicLearning> {
  const [objectives, lessons, resources, assessments] = await Promise.all([
    supabase
      .from('curriculum_objectives')
      .select('*')
      .eq('topic_id', topicId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('lessons')
      .select('*')
      .eq('topic_id', topicId)
      .eq('status', 'published')
      .order('sort_order', { ascending: true }),
    supabase
      .from('teaching_resources')
      .select('*')
      .eq('topic_id', topicId)
      .eq('status', 'published'),
    supabase
      .from('learning_assessments')
      .select('*')
      .eq('topic_id', topicId)
      .eq('status', 'published'),
  ]);
  fail(objectives.error);
  fail(lessons.error);
  fail(resources.error);
  fail(assessments.error);

  const lessonIds = (lessons.data ?? []).map((l) => l.id);
  const assessmentIds = (assessments.data ?? []).map((a) => a.id);
  const [lessonObjectives, lessonResources, activities, assessmentObjectives, questions] =
    await Promise.all([
      lessonIds.length
        ? supabase
            .from('lesson_objectives')
            .select('lesson_id, objective_id')
            .in('lesson_id', lessonIds)
        : Promise.resolve({ data: [], error: null }),
      lessonIds.length
        ? supabase
            .from('lesson_resources')
            .select('lesson_id, resource_id, sort_order')
            .in('lesson_id', lessonIds)
        : Promise.resolve({ data: [], error: null }),
      lessonIds.length
        ? supabase
            .from('learning_activities')
            .select('*')
            .in('lesson_id', lessonIds)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      assessmentIds.length
        ? supabase
            .from('assessment_objectives')
            .select('assessment_id, objective_id')
            .in('assessment_id', assessmentIds)
        : Promise.resolve({ data: [], error: null }),
      assessmentIds.length
        ? supabase
            .from('assessment_questions')
            .select('*')
            .in('assessment_id', assessmentIds)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
  fail(lessonObjectives.error);
  fail(lessonResources.error);
  fail(activities.error);
  fail(assessmentObjectives.error);
  fail(questions.error);

  const loByLesson = group(lessonObjectives.data ?? [], (r) => r.lesson_id);
  const lrByLesson = group(lessonResources.data ?? [], (r) => r.lesson_id);
  const actByLesson = group(activities.data ?? [], (r) => r.lesson_id);
  const aoByAssessment = group(assessmentObjectives.data ?? [], (r) => r.assessment_id);
  const qByAssessment = group(questions.data ?? [], (r) => r.assessment_id);

  const lessonViews: LessonView[] = (lessons.data ?? []).map((l) => ({
    ...l,
    objectiveIds: (loByLesson.get(l.id) ?? []).map((r) => r.objective_id),
    resourceIds: (lrByLesson.get(l.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => r.resource_id),
    activities: actByLesson.get(l.id) ?? [],
  }));
  const assessmentViews: AssessmentView[] = (assessments.data ?? []).map((a) => ({
    ...a,
    objectiveIds: (aoByAssessment.get(a.id) ?? []).map((r) => r.objective_id),
    questions: qByAssessment.get(a.id) ?? [],
  }));
  return {
    topicId,
    objectives: objectives.data ?? [],
    lessons: lessonViews,
    resources: resources.data ?? [],
    assessments: assessmentViews,
  };
}

async function setCurrentTopic(
  classId: string,
  schoolSubjectId: string,
  topicId: string,
): Promise<void> {
  const { error } = await supabase.rpc('set_class_current_topic', {
    p_class_id: classId,
    p_school_subject_id: schoolSubjectId,
    p_topic_id: topicId,
  });
  fail(error);
}

async function assignLearning(input: {
  classId: string;
  schoolSubjectId: string;
  lessonId?: string;
  assessmentId?: string;
  title?: string;
  instructions?: string;
  dueAt?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('assign_learning_to_class', {
    p_class_id: input.classId,
    p_school_subject_id: input.schoolSubjectId,
    p_lesson_id: input.lessonId ?? null,
    p_assessment_id: input.assessmentId ?? null,
    p_title: input.title ?? null,
    p_instructions: input.instructions ?? null,
    p_due_at: input.dueAt ?? null,
  });
  fail(error);
  return data as string;
}

async function recordResult(input: {
  learnerId: string;
  assessmentId: string;
  score: number;
}): Promise<number | null> {
  const { data, error } = await supabase.rpc('record_learning_attempt', {
    p_learner_id: input.learnerId,
    p_assessment_id: input.assessmentId,
    p_score: input.score,
  });
  fail(error);
  return (data as { percent: number | null } | null)?.percent ?? null;
}

async function getClassProgress(classId: string, objectiveId: string): Promise<ClassProgressRow[]> {
  const { data, error } = await supabase.rpc('class_objective_progress', {
    p_class_id: classId,
    p_objective_id: objectiveId,
  });
  fail(error);
  return (data ?? []) as ClassProgressRow[];
}

async function generateRecommendations(classId: string, objectiveId: string): Promise<number> {
  const { data, error } = await supabase.rpc('generate_learning_recommendations', {
    p_class_id: classId,
    p_objective_id: objectiveId,
  });
  fail(error);
  return (data as number | null) ?? 0;
}

async function listOpenRecommendations(
  objectiveId: string,
  learners: ClassProgressRow[],
  resourceTitles: Map<string, string>,
): Promise<RecommendationView[]> {
  const ids = learners.map((l) => l.learner_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('learning_recommendations')
    .select('*')
    .eq('objective_id', objectiveId)
    .eq('status', 'open')
    .in('learner_id', ids);
  fail(error);
  const names = new Map(learners.map((l) => [l.learner_id, `${l.first_name} ${l.last_name}`]));
  return (data ?? []).map((r) => ({
    ...r,
    learnerName: names.get(r.learner_id) ?? 'Learner',
    resourceTitle: r.resource_id ? (resourceTitles.get(r.resource_id) ?? null) : null,
  }));
}

async function updateRecommendation(
  id: string,
  status: 'accepted' | 'dismissed' | 'completed',
): Promise<void> {
  const { error } = await supabase.rpc('update_recommendation_status', {
    p_id: id,
    p_status: status,
  });
  fail(error);
}

// --- School setup (academic managers) -----------------------------------------------------

async function getSetupStatus(schoolId: string): Promise<SetupStatus> {
  const [versions, adoptions, grades, subjects, gradeMaps, subjectMaps] = await Promise.all([
    supabase
      .from('curriculum_versions')
      .select('id, code, name, status')
      .in('status', ['published']),
    supabase
      .from('school_curriculum_adoptions')
      .select('curriculum_version_id, status')
      .eq('school_id', schoolId),
    supabase
      .from('grades')
      .select('id, name, sort_order, active')
      .eq('school_id', schoolId)
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('subjects')
      .select('id, name, active')
      .eq('school_id', schoolId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('school_grade_curriculum_map')
      .select('school_grade_id, curriculum_version_id, curriculum_grade_id')
      .eq('school_id', schoolId),
    supabase
      .from('school_subject_curriculum_map')
      .select('school_subject_id, curriculum_version_id, curriculum_subject_id')
      .eq('school_id', schoolId),
  ]);
  fail(versions.error);
  fail(adoptions.error);
  fail(grades.error);
  fail(subjects.error);
  fail(gradeMaps.error);
  fail(subjectMaps.error);

  const versionIds = (versions.data ?? []).map((v) => v.id);
  const [cGrades, cSubjects] = await Promise.all([
    versionIds.length
      ? supabase
          .from('curriculum_grades')
          .select('id, version_id, name, sort_order')
          .in('version_id', versionIds)
          .order('sort_order')
      : Promise.resolve({ data: [], error: null }),
    versionIds.length
      ? supabase
          .from('curriculum_subjects')
          .select('id, version_id, name, sort_order')
          .in('version_id', versionIds)
          .order('sort_order')
      : Promise.resolve({ data: [], error: null }),
  ]);
  fail(cGrades.error);
  fail(cSubjects.error);

  const adopted = new Set(
    (adoptions.data ?? []).filter((a) => a.status === 'active').map((a) => a.curriculum_version_id),
  );
  return {
    versions: (versions.data ?? []).map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      adopted: adopted.has(v.id),
    })),
    schoolGrades: (grades.data ?? []).map((g) => ({ id: g.id, name: g.name })),
    schoolSubjects: (subjects.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    gradeMaps: (gradeMaps.data ?? []).map((m) => ({
      schoolGradeId: m.school_grade_id,
      curriculumVersionId: m.curriculum_version_id,
      curriculumGradeId: m.curriculum_grade_id,
    })),
    subjectMaps: (subjectMaps.data ?? []).map((m) => ({
      schoolSubjectId: m.school_subject_id,
      curriculumVersionId: m.curriculum_version_id,
      curriculumSubjectId: m.curriculum_subject_id,
    })),
    curriculumGrades: (cGrades.data ?? []).map((g) => ({
      id: g.id,
      versionId: g.version_id,
      name: g.name,
    })),
    curriculumSubjects: (cSubjects.data ?? []).map((s) => ({
      id: s.id,
      versionId: s.version_id,
      name: s.name,
    })),
  };
}

async function adoptVersion(schoolId: string, versionId: string): Promise<void> {
  const { error } = await supabase.rpc('adopt_curriculum_version', {
    p_school_id: schoolId,
    p_version_id: versionId,
  });
  fail(error);
}

async function saveGradeMap(
  schoolId: string,
  schoolGradeId: string,
  versionId: string,
  curriculumGradeId: string,
): Promise<void> {
  const { error } = await supabase.from('school_grade_curriculum_map').upsert(
    {
      school_id: schoolId,
      school_grade_id: schoolGradeId,
      curriculum_version_id: versionId,
      curriculum_grade_id: curriculumGradeId,
    },
    { onConflict: 'school_grade_id,curriculum_version_id' },
  );
  fail(error);
}

async function saveSubjectMap(
  schoolId: string,
  schoolSubjectId: string,
  versionId: string,
  curriculumSubjectId: string,
): Promise<void> {
  const { error } = await supabase.from('school_subject_curriculum_map').upsert(
    {
      school_id: schoolId,
      school_subject_id: schoolSubjectId,
      curriculum_version_id: versionId,
      curriculum_subject_id: curriculumSubjectId,
    },
    { onConflict: 'school_subject_id,curriculum_version_id' },
  );
  fail(error);
}

export const learningService = {
  listTeachingContexts,
  listTopics,
  getCurrentTopicId,
  getTopicLearning,
  setCurrentTopic,
  assignLearning,
  recordResult,
  getClassProgress,
  generateRecommendations,
  listOpenRecommendations,
  updateRecommendation,
  getSetupStatus,
  adoptVersion,
  saveGradeMap,
  saveSubjectMap,
};
