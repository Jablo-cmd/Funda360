import type {
  ComplianceFramework,
  ConsentDecision,
  ConsentPurpose,
  DataSubjectRequestRow,
  RecordAmendmentRequestRow,
  SchoolComplianceSettingsRow,
} from '@/lib/database.types';
import type { ComplianceIconKey } from '@/components/ui/complianceIcons';

/** Shape of public.get_compliance_overview() — measured control state for one school. */
export interface ComplianceOverview {
  generated_at: string;
  school: { id: string; name: string };
  settings: SchoolComplianceSettingsRow;
  learners: {
    active: number;
    minors: number;
    under_coppa_age: number;
    under_coppa_with_online_consent: number;
    core_processing_decided: number;
    online_accounts_without_consent: number;
  };
  consents: { granted: number; refused: number; withdrawn: number };
  dsar: { open: number; overdue: number; completed_90d: number };
  amendments: { open: number; overdue: number; hearings_requested: number };
  disclosures_90d: number;
  access_events_30d: number;
  audit_events_30d: number;
  content_safety: { active_rules: number; open_events: number; events_30d: number };
  mfa: { privileged_accounts: number; privileged_with_mfa: number };
  rls: { tables: number; forced: number };
}

export type ControlStatus = 'ready' | 'attention' | 'action_required';

export interface ComplianceCheck {
  label: string;
  status: ControlStatus;
  detail: string;
}

export interface FrameworkAssessment {
  framework: ComplianceFramework;
  title: string;
  jurisdiction: string;
  icon: ComplianceIconKey;
  status: ControlStatus;
  checks: ComplianceCheck[];
}

export interface SafeguardAssessment {
  key: 'encryption_transit' | 'encryption_rest' | 'rbac' | 'audit' | 'consent' | 'portability';
  title: string;
  icon: ComplianceIconKey;
  status: ControlStatus;
  detail: string;
  /** How the state is known — measured from the live system, or attested by the hosting provider. */
  evidence: 'measured' | 'provider_attested';
}

export type ConsentState = Partial<Record<ConsentPurpose, ConsentDecision | null>>;

/** One child in public.get_my_privacy_overview(). */
export interface PrivacyChild {
  learner_id: string;
  name: string;
  age: number;
  under_coppa_age: boolean;
  has_online_account: boolean;
  consents: ConsentState;
  open_amendments: number;
  open_requests: number;
}

/** Shape of public.get_my_privacy_overview() — the family's own view. */
export interface PrivacyOverview {
  settings: {
    coppa_consent_age: number;
    gdpr_digital_consent_age: number;
    privacy_notice_version: string;
    frameworks: ComplianceFramework[];
    information_officer_name: string | null;
    information_officer_email: string | null;
  };
  children: PrivacyChild[];
  requests: DataSubjectRequestRow[];
  amendments: RecordAmendmentRequestRow[];
}

export interface PrivacyHistory {
  access: { at: string; type: string; role: string; context: string; by: string }[];
  disclosures: {
    at: string;
    to: string;
    type: string;
    legal_basis: string;
    data_categories: string[];
  }[];
}

/** public.get_learner_record_package() — format funda360.learner-record.v1. */
export interface LearnerRecordPackage {
  format: 'funda360.learner-record.v1';
  generated_at: string;
  school: { id: string; name: string } | null;
  learner: Record<string, unknown>;
  enrollments: Record<string, unknown>[];
  guardians: Record<string, unknown>[];
  emergency_contacts: Record<string, unknown>[];
  medical: Record<string, unknown> | null;
  attendance: Record<string, unknown>[];
  assessment_results: Record<string, unknown>[];
  report_cards: Record<string, unknown>[];
  behaviour: Record<string, unknown>[];
  fees: { charges: Record<string, unknown>[]; payments: Record<string, unknown>[] };
  documents: Record<string, unknown>[];
  privacy: {
    consents: Record<string, unknown>[];
    amendment_requests: Record<string, unknown>[];
    disclosures: Record<string, unknown>[];
  };
}
