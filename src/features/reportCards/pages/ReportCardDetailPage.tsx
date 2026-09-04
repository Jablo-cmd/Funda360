import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useReportCardTemplates } from '@/features/reportCards/hooks/useReportCardTemplates';
import { useReportCard } from '@/features/reportCards/hooks/useReportCard';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import { generateReportCardDocument } from '@/features/reportCards/utils/generateReportCardDocument';
import { ReportCardStatusBadge } from '@/features/reportCards/components/ReportCardStatusBadge';
import { ReportCardWorkflowBar } from '@/features/reportCards/components/ReportCardWorkflowBar';
import { ReportCardCommentField } from '@/features/reportCards/components/ReportCardCommentField';
import {
  REPORT_CARD_PROMOTION_LABELS,
  isReportCardLocked,
  type ReportCard,
  type ReportCardPromotion,
} from '@/features/reportCards/types/reportCard.types';
import { attendanceRate } from '@/features/reportCards/utils/reportCardCalc';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { useToast } from '@/components/ui/toast/useToast';

const PROMOTIONS: ReportCardPromotion[] = ['not_applicable', 'promoted', 'promoted_conditionally', 'retained'];

export function ReportCardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, hasRole } = usePermissions();
  const canManage = can('reportcard.manage');
  const canApprove = can('reportcard.approve');
  const canReviewHod = can('reportcard.approve') || hasRole('department_head');
  const { school } = useSchool();
  const { showToast } = useToast();

  const { card, isLoading, error, notFound, refetch } = useReportCard(id);
  const { grades } = useGrades(school?.id);
  const { classes } = useClasses(school?.id);
  const { terms } = useTerms(card?.academicYearId);
  const { templates } = useReportCardTemplates(school?.id);

  const [actionError, setActionError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReportCard[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);

  const template = templates.find((t) => t.id === card?.templateId);

  useEffect(() => {
    if (!card) return;
    void reportCardService
      .getCardHistory(card.learnerId, card.termId, card.templateId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [card]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, successMessage: string) => {
      setActionError(null);
      try {
        await fn();
        showToast(successMessage, { variant: 'success' });
        await refetch();
      } catch (err) {
        setActionError(getDbErrorMessage(err, 'That action could not be completed.'));
      }
    },
    [refetch, showToast],
  );

  const onWorkflowAction = async (action: string, reason?: string) => {
    if (!card) return;
    const map: Record<string, [() => Promise<unknown>, string]> = {
      recalculate: [() => reportCardService.recalculate(card.id), 'Marks recalculated.'],
      submit: [() => reportCardService.submit(card.id), 'Submitted for review.'],
      hod_approve: [() => reportCardService.review(card.id, true), 'Passed HOD review.'],
      hod_return: [() => reportCardService.review(card.id, false, reason), 'Returned to the teacher.'],
      approve: [() => reportCardService.approve(card.id), 'Report card approved and locked.'],
      unapprove: [() => reportCardService.unapprove(card.id, reason ?? ''), 'Report card reopened.'],
      publish: [() => reportCardService.publish(card.id), 'Report card published.'],
      archive: [() => reportCardService.archive(card.id), 'Report card archived.'],
      reissue: [() => reportCardService.reissue(card.id, reason ?? ''), 'A new draft version was created.'],
    };
    const entry = map[action];
    if (entry) await act(entry[0], entry[1]);
  };

  const downloadPdf = async () => {
    if (!card || !school || !template) return;
    setPdfBusy(true);
    setActionError(null);
    try {
      const doc = await generateReportCardDocument(card, {
        schoolName: school.name,
        schoolAddress: school.physicalAddress,
        gradeName: grades.find((g) => g.id === card.gradeId)?.name,
        className: classes.find((c) => c.id === card.classId)?.name,
        termName: terms.find((t) => t.id === card.termId)?.name,
        academicYearName: undefined,
        template,
      });
      doc.save(`${card.learnerNumber}-report-card-v${card.version}.pdf`);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to build the PDF.'));
    } finally {
      setPdfBusy(false);
    }
  };

  if (isLoading) return <PageContainer><LoadingBlock label="Loading report card…" /></PageContainer>;
  if (notFound || !card)
    return (
      <PageContainer>
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          This report card was not found, or you do not have access to it. <Link to="/report-cards" className="text-brand-600 hover:underline">Back to report cards</Link>
        </p>
      </PageContainer>
    );

  const locked = isReportCardLocked(card.status);
  const editable = canManage && !locked;
  const rate = attendanceRate(card.attendancePresent, card.attendanceLate, card.attendanceAbsent);

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <Link to="/report-cards" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
          ← Report cards
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-content-primary">{card.learnerName}</h1>
            <p className="mt-1 text-sm text-content-secondary">
              {card.learnerNumber} · {terms.find((t) => t.id === card.termId)?.name ?? 'Term'} · v{card.version}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ReportCardStatusBadge status={card.status} />
            <Button variant="secondary" onClick={downloadPdf} isLoading={pdfBusy} disabled={!template}>
              Download PDF
            </Button>
          </div>
        </div>

        {card.status !== 'published' && (
          <p className="rounded-lg border border-border bg-surface-sunken px-3.5 py-2 text-xs text-content-tertiary">
            Staff preview. Guardians and the learner see this card only once it is <strong>published</strong>.
          </p>
        )}
        {card.supersededBy && (
          <p className="rounded-lg border border-warning-500/30 bg-warning-50 px-3.5 py-2 text-xs text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
            Superseded by a newer version.{' '}
            <Link to={`/report-cards/${card.supersededBy}`} className="underline">
              Open the current version
            </Link>
          </p>
        )}

        <ErrorAlert message={error ?? actionError} />

        <ReportCardWorkflowBar
          card={card}
          canManage={canManage}
          canApprove={canApprove}
          canReviewHod={canReviewHod}
          requiresHodReview={template?.requiresHodReview ?? false}
          onAction={onWorkflowAction}
        />

        {/* Overall + attendance + conduct */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-card border border-border bg-surface-raised p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Overall</p>
            <p className="mt-1 text-2xl font-bold text-content-primary">
              {card.overallAveragePercentage === null ? '—' : `${card.overallAveragePercentage}%`}
            </p>
            {card.overallAchievementLabel && <p className="text-xs text-content-secondary">{card.overallAchievementCode} · {card.overallAchievementLabel}</p>}
          </div>
          {template?.showAttendance && (
            <div className="rounded-card border border-border bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Attendance</p>
              <p className="mt-1 text-2xl font-bold text-content-primary">{rate === null ? '—' : `${rate}%`}</p>
              <p className="text-xs text-content-secondary">
                {card.attendancePresent}P · {card.attendanceLate}L · {card.attendanceAbsent}A · {card.attendanceExcused}E ({card.attendanceTotalDays} days)
              </p>
            </div>
          )}
          {template?.showConduct && (
            <div className="rounded-card border border-border bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Conduct</p>
              <p className="mt-1 text-2xl font-bold text-content-primary">
                +{card.conductPositiveCount} / −{card.conductNegativeCount}
              </p>
            </div>
          )}
        </div>

        {/* Subjects */}
        <div className="rounded-card border border-border bg-surface-raised">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold text-content-primary">Subjects</div>
          {card.subjects.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-content-tertiary">
              No subjects — this class has no teaching assignments or assessments for the term.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {card.subjects.map((subject) => (
                <li key={subject.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-content-primary">{subject.subjectName}</span>
                    <span className="text-sm text-content-secondary">
                      {subject.averagePercentage === null ? 'No marks' : `${subject.averagePercentage}%`}
                      {subject.achievementCode ? ` · ${subject.achievementCode}` : ''}
                      <span className="ml-2 text-xs text-content-tertiary">
                        {subject.assessmentCount} assessment{subject.assessmentCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </div>
                  {(template?.showSubjectComments ?? true) && (
                    <ReportCardCommentField
                      label={`${subject.teacherName ?? 'Teacher'} comment`}
                      value={subject.teacherComment}
                      editable={editable}
                      placeholder="Subject comment for this learner"
                      onSave={async (text) => {
                        await reportCardService.setSubjectComment(subject.id, text);
                        await refetch();
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Comments + promotion */}
        <div className="grid gap-4 rounded-card border border-border bg-surface-raised p-4 sm:grid-cols-2">
          {(template?.showClassTeacherComment ?? true) && (
            <ReportCardCommentField
              label="Class-teacher comment"
              value={card.classTeacherComment}
              editable={editable}
              onSave={async (text) => {
                await reportCardService.setComment(card.id, 'class_teacher_comment', text);
                await refetch();
              }}
            />
          )}
          {(template?.showPrincipalComment ?? true) && (
            <ReportCardCommentField
              label="Principal comment"
              value={card.principalComment}
              editable={editable && canApprove}
              onSave={async (text) => {
                await reportCardService.setComment(card.id, 'principal_comment', text);
                await refetch();
              }}
            />
          )}
          {(template?.showConduct ?? true) && (
            <ReportCardCommentField
              label="Conduct note"
              value={card.conductSummary}
              editable={editable}
              onSave={async (text) => {
                await reportCardService.setComment(card.id, 'conduct_summary', text);
                await refetch();
              }}
            />
          )}
          {(template?.showPromotion ?? true) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Promotion</span>
              {editable && canApprove ? (
                <select
                  className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
                  value={card.promotionStatus}
                  onChange={(e) =>
                    act(() => reportCardService.setPromotion(card.id, e.target.value as ReportCardPromotion), 'Promotion status updated.')
                  }
                >
                  {PROMOTIONS.map((p) => (
                    <option key={p} value={p}>
                      {REPORT_CARD_PROMOTION_LABELS[p]}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-content-secondary">{REPORT_CARD_PROMOTION_LABELS[card.promotionStatus]}</p>
              )}
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 1 && (
          <div className="rounded-card border border-border bg-surface-raised p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Version history</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {history.map((version) => (
                <li key={version.id} className="flex items-center gap-2">
                  {version.id === card.id ? (
                    <span className="font-medium text-content-primary">v{version.version} (this version)</span>
                  ) : (
                    <Link to={`/report-cards/${version.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      v{version.version}
                    </Link>
                  )}
                  <ReportCardStatusBadge status={version.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
