import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/types/assessment.types';
import type { ReportCardData } from '@/features/assessments/utils/reportCard';

export interface ReportCardPdfInput {
  schoolName: string;
  schoolAddress?: string | null;
  learnerName: string;
  learnerNumber: string;
  gradeName?: string;
  className?: string;
  periodLabel: string;
  data: ReportCardData;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Builds the PDF client-side (jsPDF + jspdf-autotable) — there is no
 * server/Edge Function in this architecture to render it instead, and the
 * data driving it (assessment results, already fetched for the Academic
 * Results tab) lives entirely in the browser already. Returns the
 * document rather than saving it directly, so callers/tests can inspect
 * it without triggering a real file-save dialog.
 *
 * Both libraries are dynamically imported, not top-level — jsPDF pulls in
 * html2canvas and together they added ~400KB to LearnerProfilePage's
 * bundle chunk when imported eagerly (533KB vs. the page's previous
 * 107KB), even though most visits never click "Download report card".
 * This keeps the cost paid only by the click that actually needs it,
 * matching the route-level code-splitting convention already established
 * in AppRoutes.tsx ("each page becomes its own chunk... instead of one
 * 600KB+ bundle shipped up front").
 */
export async function generateReportCardPdf(input: ReportCardPdfInput): Promise<InstanceType<typeof import('jspdf').jsPDF>> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 50;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(input.schoolName, marginX, y);
  y += 20;

  if (input.schoolAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(input.schoolAddress, marginX, y);
    y += 20;
  } else {
    y += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Academic Report', marginX, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const detailLines = [
    `Learner: ${input.learnerName} (${input.learnerNumber})`,
    [input.gradeName, input.className].filter(Boolean).join(' · ') || null,
    `Period: ${input.periodLabel}`,
    `Generated: ${formatDate(new Date().toISOString().slice(0, 10))}`,
  ].filter((line): line is string => Boolean(line));
  for (const line of detailLines) {
    doc.text(line, marginX, y);
    y += 16;
  }
  y += 8;

  for (const subject of input.data.subjects) {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${subject.subjectName} — ${subject.averagePercentage}% average`, marginX, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Assessment', 'Type', 'Date', 'Mark', '%']],
      body: subject.results.map((r) => [
        r.title,
        ASSESSMENT_TYPE_LABELS[r.assessmentType],
        formatDate(r.assessmentDate),
        `${r.mark}/${r.maxMark}`,
        `${Math.round((r.mark / r.maxMark) * 100)}%`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [18, 52, 91] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF's prototype at runtime; no first-party type for this.
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  if (input.data.overallAveragePercentage !== null) {
    if (y > 740) {
      doc.addPage();
      y = 50;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Overall average: ${input.data.overallAveragePercentage}%`, marginX, y);
  }

  return doc;
}
