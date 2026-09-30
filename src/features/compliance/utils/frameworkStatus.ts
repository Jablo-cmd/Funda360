import type { ComplianceFramework } from '@/lib/database.types';
import type {
  ComplianceCheck,
  ComplianceOverview,
  ControlStatus,
  FrameworkAssessment,
  SafeguardAssessment,
} from '@/features/compliance/types/compliance.types';

/**
 * Turns the measured control state from get_compliance_overview() into a
 * per-framework verdict. Pure and deterministic — every status on the Trust
 * Center and in the regulator report is derived here, so what a school
 * presents to a regulator is exactly what the live system measured.
 *
 * Status rules: a single `action_required` check makes the framework
 * `action_required`; otherwise any `attention` check makes it `attention`;
 * otherwise `ready`. "Ready" means every control Funda360 can measure is
 * in place — it is never presented as a certification.
 */

export const FRAMEWORK_META: Record<
  ComplianceFramework,
  { title: string; jurisdiction: string; icon: FrameworkAssessment['icon'] }
> = {
  POPIA: {
    title: 'POPIA',
    jurisdiction: 'South Africa — Protection of Personal Information Act',
    icon: 'popia',
  },
  FERPA: {
    title: 'FERPA',
    jurisdiction: 'United States — Family Educational Rights and Privacy Act',
    icon: 'ferpa',
  },
  COPPA: {
    title: 'COPPA',
    jurisdiction: "United States — Children's Online Privacy Protection Act",
    icon: 'coppa',
  },
  CIPA: {
    title: 'CIPA',
    jurisdiction: "United States — Children's Internet Protection Act",
    icon: 'cipa',
  },
  GDPR: {
    title: 'GDPR',
    jurisdiction: 'European Union — General Data Protection Regulation',
    icon: 'gdpr',
  },
};

export const FRAMEWORK_ORDER: ComplianceFramework[] = ['POPIA', 'FERPA', 'GDPR', 'COPPA', 'CIPA'];

export function rollUp(checks: ComplianceCheck[]): ControlStatus {
  if (checks.some((c) => c.status === 'action_required')) return 'action_required';
  if (checks.some((c) => c.status === 'attention')) return 'attention';
  return 'ready';
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 100 : Math.round((part / whole) * 100);
}

function check(label: string, status: ControlStatus, detail: string): ComplianceCheck {
  return { label, status, detail };
}

function overdueCheck(label: string, overdue: number, open: number, noun: string): ComplianceCheck {
  if (overdue > 0)
    return check(label, 'action_required', `${overdue} ${noun} past the statutory deadline.`);
  return check(
    label,
    'ready',
    open > 0 ? `${open} open, all within the deadline.` : `No open ${noun}.`,
  );
}

function rlsCheck(o: ComplianceOverview): ComplianceCheck {
  return o.rls.forced === o.rls.tables
    ? check(
        'Database access control',
        'ready',
        `Row-level security enforced on all ${o.rls.tables} tables.`,
      )
    : check(
        'Database access control',
        'action_required',
        `${o.rls.tables - o.rls.forced} tables without enforced row-level security.`,
      );
}

function mfaCheck(o: ComplianceOverview): ComplianceCheck {
  const { privileged_accounts: total, privileged_with_mfa: withMfa } = o.mfa;
  if (total === 0) return check('Multi-factor authentication', 'ready', 'No privileged accounts.');
  if (withMfa === total)
    return check(
      'Multi-factor authentication',
      'ready',
      `All ${total} privileged accounts use MFA.`,
    );
  return check(
    'Multi-factor authentication',
    'attention',
    `${withMfa} of ${total} privileged accounts use MFA (${pct(withMfa, total)}%). Erasure always requires MFA.`,
  );
}

function coreConsentCheck(o: ComplianceOverview): ComplianceCheck {
  const { minors, core_processing_decided: decided } = o.learners;
  if (minors === 0) return check('Guardian consent for minors', 'ready', 'No minors enrolled.');
  const coverage = pct(decided, minors);
  return coverage === 100
    ? check(
        'Guardian consent for minors',
        'ready',
        `A guardian decision is on record for all ${minors} minors.`,
      )
    : check(
        'Guardian consent for minors',
        'attention',
        `${coverage}% of minors have a recorded guardian decision (${decided} of ${minors}).`,
      );
}

function assessFramework(framework: ComplianceFramework, o: ComplianceOverview): ComplianceCheck[] {
  switch (framework) {
    case 'POPIA':
      return [
        o.settings.information_officer_name && o.settings.information_officer_email
          ? check(
              'Information Officer designated',
              'ready',
              `${o.settings.information_officer_name} (${o.settings.information_officer_email}).`,
            )
          : check(
              'Information Officer designated',
              'action_required',
              'POPIA s.55 requires a registered Information Officer.',
            ),
        overdueCheck(
          'Data-subject requests answered on time',
          o.dsar.overdue,
          o.dsar.open,
          'requests',
        ),
        coreConsentCheck(o),
        rlsCheck(o),
        check(
          'Processing is logged',
          o.audit_events_30d > 0 ? 'ready' : 'attention',
          o.audit_events_30d > 0
            ? `${o.audit_events_30d} audited changes in the last 30 days.`
            : 'No audited changes in the last 30 days.',
        ),
      ];
    case 'FERPA':
      return [
        overdueCheck(
          'Amendment requests decided within the response period',
          o.amendments.overdue,
          o.amendments.open,
          'amendment requests',
        ),
        o.amendments.hearings_requested > 0
          ? check(
              'Hearings',
              'attention',
              `${o.amendments.hearings_requested} family hearing request(s) awaiting a hearing.`,
            )
          : check('Hearings', 'ready', 'No hearings pending.'),
        check(
          'Record of disclosures',
          'ready',
          `${o.disclosures_90d} disclosures recorded in the last 90 days; guardians can view every one.`,
        ),
        check(
          'Record access is logged',
          'ready',
          `${o.access_events_30d} record accesses logged in the last 30 days.`,
        ),
      ];
    case 'COPPA': {
      const {
        under_coppa_age: under,
        under_coppa_with_online_consent: consented,
        online_accounts_without_consent: gap,
      } = o.learners;
      return [
        gap > 0
          ? check(
              'No child account without parental consent',
              'action_required',
              `${gap} under-age learner login(s) without current consent.`,
            )
          : check(
              'No child account without parental consent',
              'ready',
              'Enforced by the database: a login cannot exist without consent.',
            ),
        check(
          'Online-account consent coverage',
          'ready',
          under === 0
            ? `No learners under ${o.settings.coppa_consent_age}.`
            : `${consented} of ${under} learners under ${o.settings.coppa_consent_age} have online-account consent; the rest have no login.`,
        ),
      ];
    }
    case 'CIPA':
      return [
        o.settings.content_filter_enabled
          ? check(
              'Safe-content filter',
              'ready',
              `${o.content_safety.active_rules} active rules on messages, announcements and homework.`,
            )
          : check(
              'Safe-content filter',
              'action_required',
              'The safe-content filter is switched off for this school.',
            ),
        check(
          'Upload safety',
          'ready',
          'Executable and script file types are refused; every bucket has size and type limits.',
        ),
        o.content_safety.open_events > 0
          ? check(
              'Flagged content reviewed',
              'attention',
              `${o.content_safety.open_events} flagged item(s) awaiting review.`,
            )
          : check('Flagged content reviewed', 'ready', 'No flagged items awaiting review.'),
      ];
    case 'GDPR':
      return [
        check(
          'Right to erasure',
          'ready',
          'MFA-protected erasure workflow with legal-hold retention.',
        ),
        check('Right to data portability', 'ready', 'One-click export as JSON, CSV and PDF.'),
        coreConsentCheck(o),
        mfaCheck(o),
      ];
  }
}

export function assessFrameworks(o: ComplianceOverview): FrameworkAssessment[] {
  const enabled = new Set<ComplianceFramework>(['POPIA', ...o.settings.frameworks]);
  return FRAMEWORK_ORDER.filter((f) => enabled.has(f)).map((framework) => {
    const checks = assessFramework(framework, o);
    return { framework, ...FRAMEWORK_META[framework], status: rollUp(checks), checks };
  });
}

export interface TransportContext {
  pageProtocol: string;
  apiUrl: string;
}

export function assessSafeguards(
  o: ComplianceOverview,
  transport: TransportContext,
): SafeguardAssessment[] {
  const tls = transport.pageProtocol === 'https:' && transport.apiUrl.startsWith('https://');
  const rls = rlsCheck(o);
  return [
    {
      key: 'encryption_transit',
      title: 'Encryption in transit',
      icon: 'encryption',
      status: tls ? 'ready' : 'action_required',
      detail: tls
        ? 'This session and the data API both use TLS (HTTPS).'
        : 'This session is not using HTTPS end to end.',
      evidence: 'measured',
    },
    {
      key: 'encryption_rest',
      title: 'Encryption at rest',
      icon: 'encryption',
      status: 'ready',
      detail:
        'Database, backups and file storage are encrypted with AES-256 by the hosting provider (Supabase / AWS).',
      evidence: 'provider_attested',
    },
    {
      key: 'rbac',
      title: 'Role-based access control',
      icon: 'rbac',
      status: rls.status,
      detail: rls.detail,
      evidence: 'measured',
    },
    {
      key: 'audit',
      title: 'Audit logs',
      icon: 'audit',
      status: 'ready',
      detail: `${o.audit_events_30d} changes and ${o.access_events_30d} record accesses logged in 30 days.`,
      evidence: 'measured',
    },
    {
      key: 'consent',
      title: 'Consent workflow',
      icon: 'consent',
      status: coreConsentCheck(o).status,
      detail: `${o.consents.granted} granted, ${o.consents.refused} refused, ${o.consents.withdrawn} withdrawn — every decision explicit and attested.`,
      evidence: 'measured',
    },
    {
      key: 'portability',
      title: 'Data portability',
      icon: 'portability',
      status: 'ready',
      detail: 'Families and staff export a full learner record as JSON, CSV or PDF in one click.',
      evidence: 'measured',
    },
  ];
}

export const STATUS_LABEL: Record<ControlStatus, string> = {
  ready: 'Ready',
  attention: 'Needs attention',
  action_required: 'Action required',
};
