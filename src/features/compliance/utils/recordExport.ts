import { toCsv } from '@/lib/csv';
import type { LearnerRecordPackage } from '@/features/compliance/types/compliance.types';

/**
 * One-click data portability (FERPA access right, GDPR Art. 20, POPIA s.23)
 * for the learner record package returned by get_learner_record_package().
 * Three formats from the same package: JSON (machine-readable, complete),
 * CSV (one row per fact, opens in any spreadsheet — formula-safe via
 * lib/csv), and PDF (human-readable, printable).
 */

export interface RecordFactRow {
  section: string;
  date: string;
  item: string;
  detail: string;
}

/** [package path, human label] — dotted paths address nested sections. */
const SECTION_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['enrollments', 'Enrolment'],
  ['guardians', 'Guardian'],
  ['emergency_contacts', 'Emergency contact'],
  ['attendance', 'Attendance'],
  ['assessment_results', 'Assessment result'],
  ['report_cards', 'Report card'],
  ['behaviour', 'Behaviour'],
  ['fees.charges', 'Fee charge'],
  ['fees.payments', 'Fee payment'],
  ['documents', 'Document'],
  ['privacy.consents', 'Consent'],
  ['privacy.amendment_requests', 'Amendment request'],
  ['privacy.disclosures', 'Disclosure'],
];

const DATE_KEYS = [
  'date',
  'occurred_at',
  'decided_at',
  'disclosed_at',
  'enrollment_date',
  'published_at',
  'uploaded_at',
  'due_date',
  'created_at',
];
const ITEM_KEYS = [
  'assessment',
  'status',
  'description',
  'type',
  'purpose',
  'name',
  'disclosed_to',
  'academic_year',
  'record_area',
  'file_name',
];

function humanise(key: string): string {
  return key.replace(/_/g, ' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(formatValue).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function sectionRows(pkg: LearnerRecordPackage, path: string): Record<string, unknown>[] {
  const [head, tail] = path.split('.') as [string, string | undefined];
  const top = (pkg as unknown as Record<string, unknown>)[head];
  const value = tail ? (top as Record<string, unknown> | undefined)?.[tail] : top;
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function toFact(section: string, row: Record<string, unknown>): RecordFactRow {
  const dateKey = DATE_KEYS.find((k) => row[k] !== undefined && row[k] !== null);
  const itemKey = ITEM_KEYS.find((k) => row[k] !== undefined && row[k] !== null && k !== dateKey);
  const detail = Object.entries(row)
    .filter(([k, v]) => k !== dateKey && k !== itemKey && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${humanise(k)}: ${formatValue(v)}`)
    .join(' | ');
  return {
    section,
    date: dateKey ? formatValue(row[dateKey]).slice(0, 10) : '',
    item: itemKey ? formatValue(row[itemKey]) : '',
    detail,
  };
}

/** Flattens the package into one row per fact — the CSV and PDF body. */
export function recordPackageToFacts(pkg: LearnerRecordPackage): RecordFactRow[] {
  const facts: RecordFactRow[] = [];
  const learner = pkg.learner;
  for (const [key, value] of Object.entries(learner)) {
    if (value === null || value === undefined || value === '') continue;
    facts.push({ section: 'Learner', date: '', item: humanise(key), detail: formatValue(value) });
  }
  if (pkg.medical) {
    for (const [key, value] of Object.entries(pkg.medical)) {
      if (
        value === null ||
        value === undefined ||
        value === '' ||
        key === 'id' ||
        key.endsWith('_id')
      )
        continue;
      facts.push({ section: 'Medical', date: '', item: humanise(key), detail: formatValue(value) });
    }
  }
  for (const [path, label] of SECTION_LABELS) {
    for (const row of sectionRows(pkg, path)) facts.push(toFact(label, row));
  }
  return facts;
}

export function recordPackageToJson(pkg: LearnerRecordPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function recordPackageToCsv(pkg: LearnerRecordPackage): string {
  return toCsv(recordPackageToFacts(pkg), [
    { key: 'section', header: 'Section' },
    { key: 'date', header: 'Date' },
    { key: 'item', header: 'Item' },
    { key: 'detail', header: 'Detail' },
  ]);
}

export function learnerDisplayName(pkg: LearnerRecordPackage): string {
  const first = typeof pkg.learner.first_name === 'string' ? pkg.learner.first_name : '';
  const last = typeof pkg.learner.last_name === 'string' ? pkg.learner.last_name : '';
  return `${first} ${last}`.trim() || 'Learner';
}

export function exportFileBase(pkg: LearnerRecordPackage): string {
  const slug = learnerDisplayName(pkg)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `learner-record-${slug || 'learner'}-${pkg.generated_at.slice(0, 10)}`;
}

export async function recordPackageToPdf(pkg: LearnerRecordPackage) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(18, 52, 91);
  doc.text(pkg.school?.name ?? 'School', marginX, 50);
  doc.setFontSize(12);
  doc.text(`Education record — ${learnerDisplayName(pkg)}`, marginX, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Generated ${new Date(pkg.generated_at).toLocaleString('en-ZA')} · format ${pkg.format}`,
    marginX,
    86,
  );
  doc.text(
    'Provided under POPIA s.23, FERPA §99.10 and GDPR Art. 15/20. This export was recorded in the access log.',
    marginX,
    99,
  );

  autoTable(doc, {
    startY: 112,
    head: [['Section', 'Date', 'Item', 'Detail']],
    body: recordPackageToFacts(pkg).map((f) => [f.section, f.date, f.item, f.detail]),
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [18, 52, 91] },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 60 }, 2: { cellWidth: 110 } },
    margin: { left: marginX, right: marginX },
  });
  return doc;
}

export function downloadTextFile(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
