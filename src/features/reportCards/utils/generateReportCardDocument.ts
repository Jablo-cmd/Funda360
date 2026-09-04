import { REPORT_CARD_PROMOTION_LABELS } from '@/features/reportCards/types/reportCard.types';
import type { ReportCardWithSubjects, ReportCardTemplate } from '@/features/reportCards/types/reportCard.types';
import { attendanceRate } from '@/features/reportCards/utils/reportCardCalc';

/** Only the display config the PDF actually reads — the achievement codes/labels are already resolved into the report_card snapshot, so the grading scale itself is not needed here. */
export type ReportCardDisplayConfig = Pick<
  ReportCardTemplate,
  | 'showAttendance'
  | 'showConduct'
  | 'showClassTeacherComment'
  | 'showPrincipalComment'
  | 'showSubjectComments'
  | 'showPromotion'
  | 'headerNote'
  | 'footerNote'
>;

/** Every section on — used for the guardian/learner PDF, which has no access to the template table. */
export const FULL_DISPLAY_CONFIG: ReportCardDisplayConfig = {
  showAttendance: true,
  showConduct: true,
  showClassTeacherComment: true,
  showPrincipalComment: true,
  showSubjectComments: true,
  showPromotion: true,
  headerNote: null,
  footerNote: null,
};

export interface ReportCardDocumentContext {
  schoolName: string;
  schoolAddress?: string | null;
  gradeName?: string;
  className?: string;
  termName?: string;
  academicYearName?: string;
  template: ReportCardDisplayConfig;
}

function fmtDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Renders one report card onto an existing jsPDF document, starting a new
 * page unless `firstPage` is true. Returns nothing — mutates `doc`. Kept
 * separate from the single/bulk entry points so bulk generation is just a
 * loop over the same renderer (one multi-page PDF, not many downloads).
 */
function renderCard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsPDF instance; typed via the dynamic import at the call sites.
  doc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments the prototype at runtime.
  autoTable: any,
  card: ReportCardWithSubjects,
  ctx: ReportCardDocumentContext,
  firstPage: boolean,
): void {
  if (!firstPage) doc.addPage();
  const marginX = 40;
  let y = 48;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(ctx.schoolName, marginX, y);
  y += 18;
  if (ctx.schoolAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(ctx.schoolAddress, marginX, y);
    y += 16;
  }
  if (ctx.template.headerNote) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(ctx.template.headerNote, 515), marginX, y);
    y += 14;
  }
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const period = [ctx.termName, ctx.academicYearName].filter(Boolean).join(' · ');
  doc.text(`Report Card${period ? ` — ${period}` : ''}`, marginX, y);
  y += 8;
  if (card.version > 1) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Reissue — version ${card.version}`, marginX, y + 6);
  }
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const line of [
    `Learner: ${card.learnerName} (${card.learnerNumber})`,
    [ctx.gradeName, ctx.className].filter(Boolean).join(' · ') || null,
    card.status === 'published' && card.publishedAt ? `Published: ${fmtDateTime(card.publishedAt)}` : `Status: ${card.status}`,
  ].filter((l): l is string => Boolean(l))) {
    doc.text(line, marginX, y);
    y += 15;
  }
  y += 6;

  // Subjects table.
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [
      ctx.template.showSubjectComments
        ? ['Subject', 'Teacher', 'Assessments', '%', 'Level', 'Comment']
        : ['Subject', 'Teacher', 'Assessments', '%', 'Level'],
    ],
    body: card.subjects.map((s) => {
      const base = [
        s.subjectName,
        s.teacherName ?? '—',
        String(s.assessmentCount),
        s.averagePercentage === null ? '—' : `${s.averagePercentage}%`,
        s.achievementCode ? `${s.achievementCode}${s.achievementLabel ? ` (${s.achievementLabel})` : ''}` : '—',
      ];
      return ctx.template.showSubjectComments ? [...base, s.teacherComment ?? ''] : base;
    }),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [18, 52, 91] },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see the head-of-file note.
  y = (doc as any).lastAutoTable.finalY + 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const overall =
    card.overallAveragePercentage === null
      ? 'Overall average: not available (no marks recorded)'
      : `Overall average: ${card.overallAveragePercentage}%${card.overallAchievementCode ? ` — ${card.overallAchievementCode}` : ''}`;
  doc.text(overall, marginX, y);
  y += 18;

  const blocks: { title: string; body: string }[] = [];
  if (ctx.template.showAttendance) {
    const rate = attendanceRate(card.attendancePresent, card.attendanceLate, card.attendanceAbsent);
    blocks.push({
      title: 'Attendance',
      body:
        `${card.attendancePresent} present · ${card.attendanceLate} late · ${card.attendanceAbsent} absent · ${card.attendanceExcused} excused ` +
        `(${card.attendanceTotalDays} days recorded${rate === null ? '' : `, ${rate}% attendance`})`,
    });
  }
  if (ctx.template.showConduct) {
    blocks.push({
      title: 'Conduct',
      body:
        `${card.conductPositiveCount} positive · ${card.conductNegativeCount} negative` +
        (card.conductSummary ? `\n${card.conductSummary}` : ''),
    });
  }
  if (ctx.template.showSubjectComments && card.subjects.some((s) => s.teacherComment)) {
    // already in the table
  }
  if (ctx.template.showClassTeacherComment && card.classTeacherComment) {
    blocks.push({ title: 'Class teacher', body: card.classTeacherComment });
  }
  if (ctx.template.showPrincipalComment && card.principalComment) {
    blocks.push({ title: 'Principal', body: card.principalComment });
  }
  if (ctx.template.showPromotion && card.promotionStatus !== 'not_applicable') {
    blocks.push({ title: 'Promotion', body: REPORT_CARD_PROMOTION_LABELS[card.promotionStatus] });
  }

  for (const block of blocks) {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(block.title, marginX, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(block.body, 515);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 8;
  }

  if (ctx.template.footerNote) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(ctx.template.footerNote, 515), marginX, 812);
  }
}

/** One report card as its own jsPDF document. */
export async function generateReportCardDocument(
  card: ReportCardWithSubjects,
  ctx: ReportCardDocumentContext,
): Promise<InstanceType<typeof import('jspdf').jsPDF>> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  renderCard(doc, autoTable, card, ctx, true);
  return doc;
}

/** Several report cards in one multi-page document — the "bulk PDF" action. */
export async function generateReportCardBundle(
  cards: { card: ReportCardWithSubjects; ctx: ReportCardDocumentContext }[],
): Promise<InstanceType<typeof import('jspdf').jsPDF>> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  cards.forEach(({ card, ctx }, index) => renderCard(doc, autoTable, card, ctx, index === 0));
  return doc;
}
