/**
 * Client-side PDF generation for finance documents (jsPDF +
 * jspdf-autotable), same rationale and dynamic-import discipline as
 * features/assessments/utils/generateReportCardPdf.ts — there is no
 * server renderer in this architecture and the data is already in the
 * browser. Each function returns the jsPDF document so callers/tests can
 * inspect it without triggering a save dialog.
 */

import type { InvoiceWithDetail, AccountStatement, FeeReceipt } from '@/features/fees/types/invoice.types';

const BRAND: [number, number, number] = [18, 52, 91];

export interface SchoolBillingInfo {
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  bankingDetails?: string | null;
  footerNote?: string | null;
}

function money(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string): string {
  return new Date(value.length > 10 ? value : `${value}T00:00:00`).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function newDoc() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { doc: new jsPDF({ unit: 'pt', format: 'a4' }), autoTable };
}

function header(doc: InstanceType<typeof import('jspdf').jsPDF>, school: SchoolBillingInfo, docTitle: string): number {
  const marginX = 40;
  let y = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(school.name, marginX, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const line of [school.address, school.email, school.phone, school.vatNumber ? `VAT: ${school.vatNumber}` : null].filter(
    (l): l is string => Boolean(l),
  )) {
    doc.text(line, marginX, y);
    y += 12;
  }
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(docTitle, marginX, y);
  return y + 20;
}

function footer(doc: InstanceType<typeof import('jspdf').jsPDF>, school: SchoolBillingInfo) {
  const lines = [school.bankingDetails, school.footerNote].filter((l): l is string => Boolean(l));
  if (lines.length === 0) return;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = pageHeight - 20 - (lines.length - 1) * 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  for (const line of lines.join('\n').split('\n')) {
    doc.text(line, 40, y);
    y += 11;
  }
  doc.setTextColor(0);
}

export async function generateInvoicePdf(
  invoice: InvoiceWithDetail,
  school: SchoolBillingInfo,
  learnerName: string,
): Promise<InstanceType<typeof import('jspdf').jsPDF>> {
  const { doc, autoTable } = await newDoc();
  const marginX = 40;
  let y = header(doc, school, `Invoice ${invoice.invoiceNumber ?? '(draft)'}`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const line of [
    `Learner: ${learnerName}`,
    invoice.issueDate ? `Issue date: ${formatDate(invoice.issueDate)}` : 'Issue date: —',
    invoice.dueDate ? `Due date: ${formatDate(invoice.dueDate)}` : 'Due date: —',
    `Status: ${invoice.presentationStatus.replace('_', ' ')}`,
  ]) {
    doc.text(line, marginX, y);
    y += 14;
  }
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Description', 'Category', 'Amount']],
    body: invoice.lineItems.map((li) => [li.description, li.category, money(li.amount)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND },
    columnStyles: { 2: { halign: 'right' } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments the prototype at runtime.
  y = (doc as any).lastAutoTable.finalY + 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const totals: [string, string][] = [
    ['Subtotal', money(invoice.subtotal)],
    ...(invoice.vatAmount > 0 ? ([[`VAT (${invoice.vatRate}%)`, money(invoice.vatAmount)]] as [string, string][]) : []),
    ['Total', money(invoice.total)],
    ['Paid', money(invoice.amountAllocated)],
    ['Balance due', money(invoice.balance)],
  ];
  for (const [label, value] of totals) {
    doc.setFont('helvetica', label === 'Total' || label === 'Balance due' ? 'bold' : 'normal');
    doc.text(label, 360, y);
    doc.text(value, 540, y, { align: 'right' });
    y += 15;
  }

  if (invoice.notes) {
    y += 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(invoice.notes, 515), marginX, y);
  }

  footer(doc, school);
  return doc;
}

export async function generateReceiptPdf(
  receipt: FeeReceipt,
  school: SchoolBillingInfo,
  learnerName: string,
  payment: { amount: number; paymentDate: string; method: string; reference: string | null },
): Promise<InstanceType<typeof import('jspdf').jsPDF>> {
  const { doc } = await newDoc();
  const marginX = 40;
  let y = header(doc, school, `Receipt ${receipt.receiptNumber}`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const line of [
    `Received from: ${learnerName} (account)`,
    `Date: ${formatDate(payment.paymentDate)}`,
    `Method: ${payment.method.toUpperCase()}`,
    payment.reference ? `Reference: ${payment.reference}` : null,
    `Issued: ${formatDate(receipt.issuedAt)}`,
  ].filter((l): l is string => Boolean(l))) {
    doc.text(line, marginX, y);
    y += 15;
  }
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`Amount received: ${money(payment.amount)}`, marginX, y);
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('This receipt confirms funds received. It is not a tax invoice.', marginX, y);
  doc.setTextColor(0);

  footer(doc, school);
  return doc;
}

export async function generateStatementPdf(
  statement: AccountStatement,
  school: SchoolBillingInfo,
  accountName: string,
  asOf: string,
): Promise<InstanceType<typeof import('jspdf').jsPDF>> {
  const { doc, autoTable } = await newDoc();
  const marginX = 40;
  let y = header(doc, school, 'Statement of Account');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Account: ${accountName}`, marginX, y);
  y += 14;
  doc.text(`As at: ${formatDate(asOf)}`, marginX, y);
  y += 20;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Date', 'Description', 'Charge', 'Payment', 'Balance']],
    body: statement.entries.map((e) => [
      formatDate(e.date),
      e.description,
      e.debit > 0 ? money(e.debit) : '',
      e.credit > 0 ? money(e.credit) : '',
      money(e.runningBalance),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: BRAND },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments the prototype at runtime.
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Balance due: ${money(statement.closingBalance)}`, marginX, y);
  y += 20;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Current', '30 days', '60 days', '90 days', '120+ days']],
    body: [
      [
        money(statement.ageing.current),
        money(statement.ageing.days30),
        money(statement.ageing.days60),
        money(statement.ageing.days90),
        money(statement.ageing.days120Plus),
      ],
    ],
    styles: { fontSize: 8, halign: 'right' },
    headStyles: { fillColor: BRAND, halign: 'right' },
  });

  footer(doc, school);
  return doc;
}
