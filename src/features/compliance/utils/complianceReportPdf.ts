import type {
  ComplianceOverview,
  ControlStatus,
} from '@/features/compliance/types/compliance.types';
import {
  assessFrameworks,
  assessSafeguards,
  STATUS_LABEL,
  type TransportContext,
} from '@/features/compliance/utils/frameworkStatus';

/**
 * White-label compliance report a school presents to a regulator, auditor
 * or governing body. Carries the school's name and Information Officer, not
 * Funda360 branding (platform attribution is opt-in). Every status line is
 * computed by frameworkStatus.ts from the live overview, and the report
 * says so — nothing in it is a hand-typed claim.
 */

export interface ComplianceReportOptions {
  reportingPeriodLabel: string;
  preparedBy: string;
  includePlatformAttribution?: boolean;
  transport: TransportContext;
}

const NAVY: [number, number, number] = [18, 52, 91];
const ORANGE: [number, number, number] = [234, 88, 12];

const STATUS_COLOUR: Record<ControlStatus, [number, number, number]> = {
  ready: [21, 128, 61],
  attention: [180, 83, 9],
  action_required: [185, 28, 28],
};

export async function generateComplianceReportPdf(
  overview: ComplianceOverview,
  options: ComplianceReportOptions,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const frameworks = assessFrameworks(overview);
  const safeguards = assessSafeguards(overview, options.transport);
  const s = overview.settings;

  // Header band — school identity.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 90, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 90, pageWidth, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(overview.school.name, marginX, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Data Protection & Student Privacy Compliance Report', marginX, 64);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  let y = 118;
  const meta: Array<[string, string]> = [
    ['Reporting period', options.reportingPeriodLabel],
    ['Generated', new Date(overview.generated_at).toLocaleString('en-ZA')],
    ['Prepared by', options.preparedBy],
    [
      'Information Officer',
      s.information_officer_name
        ? `${s.information_officer_name} <${s.information_officer_email ?? ''}>`
        : 'Not designated',
    ],
    ['Frameworks in scope', ['POPIA', ...s.frameworks.filter((f) => f !== 'POPIA')].join(', ')],
    ['Privacy notice version', s.privacy_notice_version],
  ];
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, marginX + 120, y);
    y += 13;
  }

  // Framework summary.
  autoTable(doc, {
    startY: y + 8,
    head: [['Framework', 'Scope', 'Status']],
    body: frameworks.map((f) => [f.title, f.jurisdiction, STATUS_LABEL[f.status]]),
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const framework = frameworks[data.row.index];
        if (framework) data.cell.styles.textColor = STATUS_COLOUR[framework.status];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: marginX, right: marginX },
  });

  // Control detail per framework.
  autoTable(doc, {
    head: [['Framework', 'Control', 'Status', 'Evidence (measured from the live system)']],
    body: frameworks.flatMap((f) =>
      f.checks.map((c) => [f.title, c.label, STATUS_LABEL[c.status], c.detail]),
    ),
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 130 }, 2: { cellWidth: 70 } },
    margin: { left: marginX, right: marginX },
  });

  // Technical safeguards.
  autoTable(doc, {
    head: [['Technical safeguard', 'Status', 'Evidence', 'Basis']],
    body: safeguards.map((g) => [
      g.title,
      STATUS_LABEL[g.status],
      g.detail,
      g.evidence === 'measured' ? 'Measured' : 'Provider-attested',
    ]),
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8, overflow: 'linebreak' },
    margin: { left: marginX, right: marginX },
  });

  // Key metrics.
  autoTable(doc, {
    head: [['Metric', 'Value']],
    body: [
      ['Active learners (minors)', `${overview.learners.active} (${overview.learners.minors})`],
      [
        `Learners under ${s.coppa_consent_age} / with online-account consent`,
        `${overview.learners.under_coppa_age} / ${overview.learners.under_coppa_with_online_consent}`,
      ],
      [
        'Consent decisions: granted / refused / withdrawn',
        `${overview.consents.granted} / ${overview.consents.refused} / ${overview.consents.withdrawn}`,
      ],
      [
        'Data-subject requests: open / overdue / completed (90 days)',
        `${overview.dsar.open} / ${overview.dsar.overdue} / ${overview.dsar.completed_90d}`,
      ],
      [
        'Amendment requests: open / overdue / hearings',
        `${overview.amendments.open} / ${overview.amendments.overdue} / ${overview.amendments.hearings_requested}`,
      ],
      ['Disclosures recorded (90 days)', String(overview.disclosures_90d)],
      ['Record accesses logged (30 days)', String(overview.access_events_30d)],
      ['Audited changes (30 days)', String(overview.audit_events_30d)],
      [
        'Safe-content rules active / flags open',
        `${overview.content_safety.active_rules} / ${overview.content_safety.open_events}`,
      ],
      [
        'Privileged accounts with MFA',
        `${overview.mfa.privileged_with_mfa} of ${overview.mfa.privileged_accounts}`,
      ],
      [
        'Tables with enforced row-level security',
        `${overview.rls.forced} of ${overview.rls.tables}`,
      ],
    ],
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8 },
    margin: { left: marginX, right: marginX },
  });

  // Attestation.
  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let ay = (lastTable?.finalY ?? y) + 30;
  if (ay > doc.internal.pageSize.getHeight() - 140) {
    doc.addPage();
    ay = 60;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('Attestation', marginX, ay);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  const statement = doc.splitTextToSize(
    'The statuses in this report are computed automatically from the school\'s live records at the time of generation. "Ready" means every control the platform can measure is in place; it is not a certification by a regulator or auditor. Encryption at rest is attested by the hosting provider.',
    pageWidth - marginX * 2,
  ) as string[];
  doc.text(statement, marginX, ay + 16);
  const sy = ay + 16 + statement.length * 11 + 36;
  doc.line(marginX, sy, marginX + 200, sy);
  doc.line(marginX + 260, sy, marginX + 460, sy);
  doc.text('Information Officer — signature', marginX, sy + 12);
  doc.text('Date', marginX + 260, sy + 12);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    const footer = options.includePlatformAttribution
      ? `${overview.school.name} · Confidential · Generated with Funda360 · Page ${i} of ${pages}`
      : `${overview.school.name} · Confidential · Page ${i} of ${pages}`;
    doc.text(footer, marginX, doc.internal.pageSize.getHeight() - 24);
  }
  return doc;
}
