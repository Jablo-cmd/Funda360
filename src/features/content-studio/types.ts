import type {
  AssessmentQuestionRow,
  ContentEntityTable,
  ContentProvenance,
  ContentSourceReferenceRow,
  ContentStatus,
  ContentValidationFindingRow,
  CurriculumObjectiveRow,
  CurriculumSourceRow,
  LearningActivityRow,
  LearningAssessmentRow,
  LessonRow,
  TeachingResourceRow,
} from '@/lib/database.types';

export interface VersionOption {
  id: string;
  code: string;
  name: string;
  status: ContentStatus;
}

export interface TopicChoice {
  id: string;
  label: string;
  objectives: CurriculumObjectiveRow[];
}

export interface UnitSummary {
  table: ContentEntityTable;
  id: string;
  title: string;
  status: ContentStatus;
  origin: 'authored' | 'ai_draft';
  topicLabel: string;
  updatedAt: string;
}

export type UnitContent =
  | {
      kind: 'lessons';
      lesson: LessonRow;
      objectives: Array<{ code: string; description: string }>;
      activities: LearningActivityRow[];
      resources: Array<{ id: string; title: string; stage: string; status: ContentStatus }>;
    }
  | { kind: 'teaching_resources'; resource: TeachingResourceRow }
  | {
      kind: 'learning_assessments';
      assessment: LearningAssessmentRow;
      questions: Array<AssessmentQuestionRow & { answer: string | null; feedback: string | null }>;
    };

export interface ReviewData {
  content: UnitContent;
  provenance: ContentProvenance;
  findings: ContentValidationFindingRow[];
  sources: CurriculumSourceRow[];
  references: ContentSourceReferenceRow[];
}

export type DraftResponse =
  | {
      status: 'draft_created';
      requestId: string;
      lessonId: string;
      resourceIds: string[];
      assessmentId: string | null;
    }
  | { status: 'rejected_output'; requestId: string; reasons: string[] }
  | { status: 'failed'; requestId: string; reason: string };
