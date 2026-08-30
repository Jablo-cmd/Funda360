import type { LearnerTransfer } from '@/features/learners/types/learner.types';

export interface TransferLetterPdfInput {
  schoolName: string;
  schoolAddress?: string | null;
  learnerName: string;
  learnerNumber: string;
  admissionNumber: string;
  gradeName?: string;
  transfer: LearnerTransfer;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Builds a formal outgoing-transfer letter client-side, same jsPDF pattern
 * (and same dynamic-import-to-avoid-bloating-the-route-chunk reasoning) as
 * generateReportCardPdf.ts — see that file's own doc comment for the full
 * bundle-size rationale, unchanged here. Deliberately only meaningful for
 * an 'outgoing' transfer: this is our school's own letterhead confirming a
 * departing learner to the receiving school, not something that makes
 * sense to generate for an 'incoming' record (a note-to-self about a
 * learner who has already arrived, not a letter addressed to anyone).
 * Callers should not offer this action for transfer.direction === 'incoming'.
 */
export async function generateTransferLetterPdf(input: TransferLetterPdfInput): Promise<InstanceType<typeof import('jspdf').jsPDF>> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 60;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(input.schoolName, marginX, y);
  y += 20;

  if (input.schoolAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(input.schoolAddress, marginX, y);
    y += 24;
  } else {
    y += 12;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(formatDate(new Date().toISOString().slice(0, 10)), pageWidth - marginX, 60, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Learner Transfer Letter', marginX, y);
  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const toLines = [
    'To: The Registrar',
    input.transfer.otherSchoolName,
    input.transfer.otherSchoolContact ?? undefined,
  ].filter((line): line is string => Boolean(line));
  for (const line of toLines) {
    doc.text(line, marginX, y);
    y += 15;
  }
  y += 15;

  const bodyLines = [
    `This letter confirms that ${input.learnerName} (learner number ${input.learnerNumber}, admission number ${input.admissionNumber}${input.gradeName ? `, ${input.gradeName}` : ''}) was enrolled at ${input.schoolName} and transferred out effective ${formatDate(input.transfer.transferDate)}.`,
  ];
  if (input.transfer.reason) {
    bodyLines.push(`Reason for transfer: ${input.transfer.reason}`);
  }
  bodyLines.push('We wish the learner every success in their continued education.');

  for (const paragraph of bodyLines) {
    const wrapped = doc.splitTextToSize(paragraph, pageWidth - marginX * 2) as string[];
    for (const line of wrapped) {
      doc.text(line, marginX, y);
      y += 16;
    }
    y += 10;
  }

  y += 40;
  doc.text('_______________________________', marginX, y);
  y += 16;
  doc.setFontSize(10);
  doc.text('Authorized signature', marginX, y);

  return doc;
}
