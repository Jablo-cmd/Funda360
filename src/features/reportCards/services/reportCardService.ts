import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/pagination';
import type {
  ReportCardRow,
  ReportCardSubjectRow,
  ReportCardTemplateRow,
  ReportCardTemplateInsert,
  ReportCardBatchRow,
  ReportCardPromotion,
} from '@/lib/database.types';
import type {
  ReportCard,
  ReportCardSubject,
  ReportCardWithSubjects,
  ReportCardTemplate,
  ReportCardBatch,
} from '@/features/reportCards/types/reportCard.types';

function toTemplate(row: ReportCardTemplateRow): ReportCardTemplate {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    gradingScaleId: row.grading_scale_id,
    isDefault: row.is_default,
    active: row.active,
    showAttendance: row.show_attendance,
    showConduct: row.show_conduct,
    showClassTeacherComment: row.show_class_teacher_comment,
    showPrincipalComment: row.show_principal_comment,
    showSubjectComments: row.show_subject_comments,
    showPromotion: row.show_promotion,
    requiresHodReview: row.requires_hod_review,
    headerNote: row.header_note,
    footerNote: row.footer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCard(row: ReportCardRow): ReportCard {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    gradeId: row.grade_id,
    classId: row.class_id,
    templateId: row.template_id,
    batchId: row.batch_id,
    version: row.version,
    status: row.status,
    supersededBy: row.superseded_by,
    learnerName: row.learner_name,
    learnerNumber: row.learner_number,
    classTeacherComment: row.class_teacher_comment,
    principalComment: row.principal_comment,
    conductSummary: row.conduct_summary,
    promotionStatus: row.promotion_status,
    overallAveragePercentage: row.overall_average_percentage,
    overallAchievementCode: row.overall_achievement_code,
    overallAchievementLabel: row.overall_achievement_label,
    attendancePresent: row.attendance_present,
    attendanceAbsent: row.attendance_absent,
    attendanceLate: row.attendance_late,
    attendanceExcused: row.attendance_excused,
    attendanceTotalDays: row.attendance_total_days,
    conductPositiveCount: row.conduct_positive_count,
    conductNegativeCount: row.conduct_negative_count,
    generatedAt: row.generated_at,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    lockedAt: row.locked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSubject(row: ReportCardSubjectRow): ReportCardSubject {
  return {
    id: row.id,
    reportCardId: row.report_card_id,
    schoolId: row.school_id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    teacherProfileId: row.teacher_profile_id,
    teacherName: row.teacher_name,
    weight: row.weight,
    averagePercentage: row.average_percentage,
    achievementCode: row.achievement_code,
    achievementLabel: row.achievement_label,
    teacherComment: row.teacher_comment,
    assessmentCount: row.assessment_count,
    sortOrder: row.sort_order,
  };
}

function toBatch(row: ReportCardBatchRow): ReportCardBatch {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    classId: row.class_id,
    templateId: row.template_id,
    generatedCount: row.generated_count,
    skippedCount: row.skipped_count,
    createdAt: row.created_at,
  };
}

// --- Templates -------------------------------------------------------------

async function listTemplates(schoolId: string): Promise<ReportCardTemplate[]> {
  const { data, error } = await supabase
    .from('report_card_templates')
    .select('*')
    .eq('school_id', schoolId)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data.map(toTemplate);
}

export type TemplateInput = Omit<ReportCardTemplateInsert, 'school_id' | 'id'>;

async function createTemplate(schoolId: string, input: TemplateInput): Promise<ReportCardTemplate> {
  const { data, error } = await supabase
    .from('report_card_templates')
    .insert({ ...input, school_id: schoolId })
    .select('*')
    .single();
  if (error) throw error;
  return toTemplate(data);
}

async function updateTemplate(id: string, input: Partial<TemplateInput>): Promise<ReportCardTemplate> {
  const { data, error } = await supabase.from('report_card_templates').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return toTemplate(data);
}

async function archiveTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('report_card_templates').update({ active: false, is_default: false }).eq('id', id);
  if (error) throw error;
}

// --- Report cards ---------------------------------------------------------

async function listCards(
  schoolId: string,
  filters: { classId?: string; termId?: string; learnerId?: string; status?: string } = {},
): Promise<ReportCard[]> {
  const rows = await fetchAllRows<ReportCardRow>((from, to) => {
    let query = supabase.from('report_cards').select('*').eq('school_id', schoolId);
    if (filters.classId) query = query.eq('class_id', filters.classId);
    if (filters.termId) query = query.eq('term_id', filters.termId);
    if (filters.learnerId) query = query.eq('learner_id', filters.learnerId);
    if (filters.status) query = query.eq('status', filters.status);
    return query.order('generated_at', { ascending: false }).range(from, to);
  });
  return rows.map(toCard);
}

/**
 * A single learner's report cards, newest first. No school filter — RLS is
 * the tenant boundary, and a guardian/learner caller has no school id to
 * pass anyway.
 */
async function listCardsForLearner(learnerId: string): Promise<ReportCard[]> {
  const rows = await fetchAllRows<ReportCardRow>((from, to) =>
    supabase.from('report_cards').select('*').eq('learner_id', learnerId).order('generated_at', { ascending: false }).range(from, to),
  );
  return rows.map(toCard);
}

async function getCard(id: string): Promise<ReportCardWithSubjects | null> {
  const { data, error } = await supabase.from('report_cards').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: subjects, error: subjectsError } = await supabase
    .from('report_card_subjects')
    .select('*')
    .eq('report_card_id', id)
    .order('subject_name', { ascending: true });
  if (subjectsError) throw subjectsError;
  return { ...toCard(data), subjects: subjects.map(toSubject) };
}

/** Subject rows for several report cards in one request — for the bulk PDF. */
async function getSubjectsForCards(cardIds: string[]): Promise<ReportCardSubject[]> {
  if (cardIds.length === 0) return [];
  const rows = await fetchAllRows<ReportCardSubjectRow>((from, to) =>
    supabase.from('report_card_subjects').select('*').in('report_card_id', cardIds).range(from, to),
  );
  return rows.map(toSubject);
}

/** Every version of a learner's report cards for a term/template, newest version first — the history view. */
async function getCardHistory(learnerId: string, termId: string, templateId: string): Promise<ReportCard[]> {
  const { data, error } = await supabase
    .from('report_cards')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('term_id', termId)
    .eq('template_id', templateId)
    .order('version', { ascending: false });
  if (error) throw error;
  return data.map(toCard);
}

// --- Workflow RPCs (server enforces authorisation + locking) --------------

async function generate(learnerId: string, termId: string, templateId: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('generate_report_card', {
    p_learner_id: learnerId,
    p_term_id: termId,
    p_template_id: templateId,
  });
  if (error) throw error;
  return toCard(data);
}

async function generateForClass(classId: string, termId: string, templateId: string): Promise<ReportCardBatch> {
  const { data, error } = await supabase.rpc('generate_report_cards_for_class', {
    p_class_id: classId,
    p_term_id: termId,
    p_template_id: templateId,
  });
  if (error) throw error;
  return toBatch(data);
}

async function recalculate(id: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('recalculate_report_card', { p_report_card_id: id });
  if (error) throw error;
  return toCard(data);
}

async function setSubjectComment(subjectRowId: string, comment: string): Promise<ReportCardSubject> {
  const { data, error } = await supabase.rpc('set_report_card_subject_comment', {
    p_subject_row_id: subjectRowId,
    p_comment: comment,
  });
  if (error) throw error;
  return toSubject(data);
}

async function setComment(
  id: string,
  field: 'class_teacher_comment' | 'principal_comment' | 'conduct_summary',
  text: string,
): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('set_report_card_comment', { p_report_card_id: id, p_field: field, p_text: text });
  if (error) throw error;
  return toCard(data);
}

async function setPromotion(id: string, status: ReportCardPromotion): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('set_report_card_promotion', { p_report_card_id: id, p_status: status });
  if (error) throw error;
  return toCard(data);
}

async function submit(id: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('submit_report_card', { p_report_card_id: id });
  if (error) throw error;
  return toCard(data);
}

async function review(id: string, approve: boolean, note?: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('review_report_card', { p_report_card_id: id, p_approve: approve, p_note: note ?? null });
  if (error) throw error;
  return toCard(data);
}

async function approve(id: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('approve_report_card', { p_report_card_id: id });
  if (error) throw error;
  return toCard(data);
}

async function unapprove(id: string, reason: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('unapprove_report_card', { p_report_card_id: id, p_reason: reason });
  if (error) throw error;
  return toCard(data);
}

async function publish(id: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('publish_report_card', { p_report_card_id: id });
  if (error) throw error;
  return toCard(data);
}

async function archive(id: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('archive_report_card', { p_report_card_id: id });
  if (error) throw error;
  return toCard(data);
}

async function reissue(id: string, reason: string): Promise<ReportCard> {
  const { data, error } = await supabase.rpc('reissue_report_card', { p_report_card_id: id, p_reason: reason });
  if (error) throw error;
  return toCard(data);
}

async function publishBatch(batchId: string): Promise<number> {
  const { data, error } = await supabase.rpc('publish_report_card_batch', { p_batch_id: batchId });
  if (error) throw error;
  return data as number;
}

export const reportCardService = {
  listTemplates,
  createTemplate,
  updateTemplate,
  archiveTemplate,
  listCards,
  listCardsForLearner,
  getCard,
  getSubjectsForCards,
  getCardHistory,
  generate,
  generateForClass,
  recalculate,
  setSubjectComment,
  setComment,
  setPromotion,
  submit,
  review,
  approve,
  unapprove,
  publish,
  archive,
  reissue,
  publishBatch,
};
