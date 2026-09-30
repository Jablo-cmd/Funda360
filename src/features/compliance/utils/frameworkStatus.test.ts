import { describe, expect, it } from 'vitest';
import {
  assessFrameworks,
  assessSafeguards,
  rollUp,
} from '@/features/compliance/utils/frameworkStatus';
import type { ComplianceOverview } from '@/features/compliance/types/compliance.types';

function overview(overrides: Partial<ComplianceOverview> = {}): ComplianceOverview {
  return {
    generated_at: '2026-09-30T10:00:00Z',
    school: { id: 's1', name: 'Riverside College' },
    settings: {
      school_id: 's1',
      frameworks: ['POPIA', 'FERPA', 'COPPA', 'CIPA', 'GDPR'],
      coppa_consent_age: 13,
      gdpr_digital_consent_age: 16,
      ferpa_amendment_response_days: 45,
      dsar_response_days: 30,
      content_filter_enabled: true,
      information_officer_name: 'Dr N. Dube',
      information_officer_email: 'privacy@riverside.test',
      privacy_notice_version: '2026-09',
      updated_by: null,
      updated_at: '2026-09-30T10:00:00Z',
    },
    learners: {
      active: 10,
      minors: 10,
      under_coppa_age: 4,
      under_coppa_with_online_consent: 2,
      core_processing_decided: 10,
      online_accounts_without_consent: 0,
    },
    consents: { granted: 12, refused: 1, withdrawn: 0 },
    dsar: { open: 1, overdue: 0, completed_90d: 3 },
    amendments: { open: 0, overdue: 0, hearings_requested: 0 },
    disclosures_90d: 2,
    access_events_30d: 40,
    audit_events_30d: 120,
    content_safety: { active_rules: 6, open_events: 0, events_30d: 1 },
    mfa: { privileged_accounts: 3, privileged_with_mfa: 3 },
    rls: { tables: 125, forced: 125 },
    ...overrides,
  };
}

describe('rollUp', () => {
  it('is action_required when any check is', () => {
    expect(
      rollUp([
        { label: 'a', status: 'ready', detail: '' },
        { label: 'b', status: 'action_required', detail: '' },
      ]),
    ).toBe('action_required');
  });
  it('is ready only when every check is ready', () => {
    expect(rollUp([{ label: 'a', status: 'ready', detail: '' }])).toBe('ready');
    expect(rollUp([{ label: 'a', status: 'attention', detail: '' }])).toBe('attention');
  });
});

describe('assessFrameworks', () => {
  it('reports every enabled framework ready for a fully configured school', () => {
    const result = assessFrameworks(overview());
    expect(result.map((f) => f.framework)).toEqual(['POPIA', 'FERPA', 'GDPR', 'COPPA', 'CIPA']);
    expect(result.every((f) => f.status === 'ready')).toBe(true);
  });

  it('always includes POPIA, even when a school enabled only FERPA', () => {
    const o = overview();
    const result = assessFrameworks({ ...o, settings: { ...o.settings, frameworks: ['FERPA'] } });
    expect(result.map((f) => f.framework)).toEqual(['POPIA', 'FERPA']);
  });

  it('requires action on POPIA when no Information Officer is designated', () => {
    const o = overview();
    const popia = assessFrameworks({
      ...o,
      settings: { ...o.settings, information_officer_name: null },
    })[0];
    expect(popia?.status).toBe('action_required');
  });

  it('requires action on POPIA when a data-subject request is overdue', () => {
    const popia = assessFrameworks(
      overview({ dsar: { open: 2, overdue: 1, completed_90d: 0 } }),
    )[0];
    expect(popia?.status).toBe('action_required');
  });

  it('requires action on COPPA when a child login exists without consent', () => {
    const o = overview();
    const coppa = assessFrameworks({
      ...o,
      learners: { ...o.learners, online_accounts_without_consent: 1 },
    }).find((f) => f.framework === 'COPPA');
    expect(coppa?.status).toBe('action_required');
  });

  it('requires action on CIPA when the content filter is off', () => {
    const o = overview();
    const cipa = assessFrameworks({
      ...o,
      settings: { ...o.settings, content_filter_enabled: false },
    }).find((f) => f.framework === 'CIPA');
    expect(cipa?.status).toBe('action_required');
  });

  it('flags FERPA for attention while a hearing is pending', () => {
    const ferpa = assessFrameworks(
      overview({ amendments: { open: 1, overdue: 0, hearings_requested: 1 } }),
    ).find((f) => f.framework === 'FERPA');
    expect(ferpa?.status).toBe('attention');
  });

  it('flags GDPR for attention when privileged accounts lack MFA', () => {
    const gdpr = assessFrameworks(
      overview({ mfa: { privileged_accounts: 4, privileged_with_mfa: 1 } }),
    ).find((f) => f.framework === 'GDPR');
    expect(gdpr?.status).toBe('attention');
    expect(gdpr?.checks.find((c) => c.label === 'Multi-factor authentication')?.detail).toContain(
      '25%',
    );
  });
});

describe('assessSafeguards', () => {
  it('measures TLS from the live session and the API URL', () => {
    const secure = assessSafeguards(overview(), {
      pageProtocol: 'https:',
      apiUrl: 'https://x.supabase.co',
    });
    expect(secure.find((s) => s.key === 'encryption_transit')?.status).toBe('ready');
    const insecure = assessSafeguards(overview(), {
      pageProtocol: 'http:',
      apiUrl: 'https://x.supabase.co',
    });
    expect(insecure.find((s) => s.key === 'encryption_transit')?.status).toBe('action_required');
  });

  it('labels encryption at rest as provider-attested, never as measured', () => {
    const rest = assessSafeguards(overview(), { pageProtocol: 'https:', apiUrl: 'https://x' }).find(
      (s) => s.key === 'encryption_rest',
    );
    expect(rest?.evidence).toBe('provider_attested');
  });

  it('fails RBAC when any table lacks enforced row-level security', () => {
    const rbac = assessSafeguards(overview({ rls: { tables: 125, forced: 124 } }), {
      pageProtocol: 'https:',
      apiUrl: 'https://x',
    }).find((s) => s.key === 'rbac');
    expect(rbac?.status).toBe('action_required');
  });
});
