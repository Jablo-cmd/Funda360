import type {
  AssessmentQuestionRow,
  ClassObjectiveProgressRow,
  CurriculumObjectiveRow,
  LearningActivityRow,
  LearningAssessmentRow,
  LearningRecommendationRow,
  LessonRow,
  TeachingResourceRow,
} from '@/lib/database.types';

/** One class + subject a teacher can teach, already resolved to the curriculum the school follows. */
export interface TeachingContext {
  key: string;
  classId: string;
  className: string;
  schoolSubjectId: string;
  subjectName: string;
  curriculumVersionId: string;
  curriculumGradeId: string;
  curriculumSubjectId: string;
}

export interface TopicOption {
  id: string;
  code: string;
  title: string;
  termNumber: number;
  sortOrder: number;
}

export interface LessonView extends LessonRow {
  objectiveIds: string[];
  resourceIds: string[];
  activities: LearningActivityRow[];
}

export interface AssessmentView extends LearningAssessmentRow {
  objectiveIds: string[];
  questions: AssessmentQuestionRow[];
}

export interface TopicLearning {
  topicId: string;
  objectives: CurriculumObjectiveRow[];
  lessons: LessonView[];
  resources: TeachingResourceRow[];
  assessments: AssessmentView[];
}

export type ClassProgressRow = ClassObjectiveProgressRow;

export interface RecommendationView extends LearningRecommendationRow {
  learnerName: string;
  resourceTitle: string | null;
}

export interface SetupStatus {
  versions: Array<{ id: string; code: string; name: string; adopted: boolean }>;
  schoolGrades: Array<{ id: string; name: string }>;
  schoolSubjects: Array<{ id: string; name: string }>;
  gradeMaps: Array<{
    schoolGradeId: string;
    curriculumVersionId: string;
    curriculumGradeId: string;
  }>;
  subjectMaps: Array<{
    schoolSubjectId: string;
    curriculumVersionId: string;
    curriculumSubjectId: string;
  }>;
  curriculumGrades: Array<{ id: string; versionId: string; name: string }>;
  curriculumSubjects: Array<{ id: string; versionId: string; name: string }>;
}
