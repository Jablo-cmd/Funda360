import { test, expect, type Page } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  MOCK_TENANT_ID,
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
} from './utils/mockData';

const LEARNER_ID = '11110000-0000-0000-0000-000000000001';

function overview(overrides: Record<string, unknown> = {}) {
  return {
    generated_at: '2026-09-30T08:00:00Z',
    school: { id: MOCK_TENANT_ID, name: 'Riverside Secondary School' },
    settings: {
      school_id: MOCK_TENANT_ID,
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
      updated_at: '2026-09-30T08:00:00Z',
    },
    learners: {
      active: 20,
      minors: 20,
      under_coppa_age: 6,
      under_coppa_with_online_consent: 2,
      core_processing_decided: 20,
      online_accounts_without_consent: 0,
    },
    consents: { granted: 24, refused: 2, withdrawn: 1 },
    dsar: { open: 1, overdue: 0, completed_90d: 2 },
    amendments: { open: 0, overdue: 0, hearings_requested: 0 },
    disclosures_90d: 3,
    access_events_30d: 57,
    audit_events_30d: 212,
    content_safety: { active_rules: 6, open_events: 0, events_30d: 1 },
    mfa: { privileged_accounts: 2, privileged_with_mfa: 2 },
    rls: { tables: 125, forced: 125 },
    ...overrides,
  };
}

function privacyOverview(consents: Record<string, string | null>) {
  return {
    settings: {
      coppa_consent_age: 13,
      gdpr_digital_consent_age: 16,
      privacy_notice_version: '2026-09',
      frameworks: ['POPIA', 'FERPA', 'COPPA', 'CIPA', 'GDPR'],
      information_officer_name: 'Dr N. Dube',
      information_officer_email: 'privacy@riverside.test',
    },
    children: [
      {
        learner_id: LEARNER_ID,
        name: 'Naledi Dube',
        age: 11,
        under_coppa_age: true,
        has_online_account: false,
        consents,
        open_amendments: 0,
        open_requests: 0,
      },
    ],
    requests: [],
    amendments: [],
  };
}

async function mockRpc(
  page: Page,
  name: string,
  body: unknown | ((payload: unknown) => unknown),
  status = 200,
) {
  await page.route(`**/rest/v1/rpc/${name}`, async (route) => {
    const payload = route.request().postDataJSON() as unknown;
    await fulfillJson(
      route,
      typeof body === 'function' ? (body as (p: unknown) => unknown)(payload) : body,
      status,
    );
  });
}

test.describe('Trust Center', () => {
  test('a principal sees live framework status and the regulator report action', async ({
    page,
  }) => {
    await seedAuthenticatedSession(page, { role: 'principal' });
    await installDataMocks(page, {
      profile: buildMockProfileRow({ role: 'principal' }),
      school: buildMockSchoolRow(),
    });
    await mockRpc(page, 'get_compliance_overview', overview());

    await page.goto('/compliance');
    await expect(page.getByRole('heading', { name: 'Trust Center' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'POPIA + FERPA + GDPR ready' })).toBeVisible();
    for (const framework of ['POPIA', 'FERPA', 'GDPR', 'COPPA', 'CIPA']) {
      await expect(page.getByRole('heading', { name: framework, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Provider-attested', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Regulator report (PDF)' })).toBeVisible();
  });

  test('a missing Information Officer is reported as action required', async ({ page }) => {
    await seedAuthenticatedSession(page, { role: 'principal' });
    await installDataMocks(page, {
      profile: buildMockProfileRow({ role: 'principal' }),
      school: buildMockSchoolRow(),
    });
    const o = overview();
    await mockRpc(page, 'get_compliance_overview', {
      ...o,
      settings: { ...o.settings, information_officer_name: null, information_officer_email: null },
    });

    await page.goto('/compliance');
    await expect(
      page.getByText('POPIA s.55 requires a registered Information Officer.'),
    ).toBeVisible();
  });

  test('a teacher cannot reach the Trust Center', async ({ page }) => {
    await seedAuthenticatedSession(page, { role: 'teacher' });
    await installDataMocks(page, {
      profile: buildMockProfileRow({ role: 'teacher' }),
      school: buildMockSchoolRow(),
    });

    await page.goto('/compliance');
    await expect(page).not.toHaveURL(/\/compliance$/);
  });

  test('the principal navigation includes the Trust Center', async ({ page }) => {
    await seedAuthenticatedSession(page, { role: 'principal' });
    await installDataMocks(page, {
      profile: buildMockProfileRow({ role: 'principal' }),
      school: buildMockSchoolRow(),
    });
    await mockRpc(page, 'get_compliance_overview', overview());

    await page.goto('/compliance');
    await expect(page.getByRole('link', { name: 'Trust Center' }).first()).toBeVisible();
  });
});

test.describe('Parent consent onboarding', () => {
  test('a guardian must decide required consents before the portal opens, with nothing pre-selected', async ({
    page,
  }) => {
    await seedAuthenticatedSession(page, { role: 'guardian' });
    await installDataMocks(page, {
      profile: buildMockProfileRow({ role: 'guardian' }),
      school: buildMockSchoolRow(),
    });

    const recorded: Array<Record<string, unknown>> = [];
    let consents: Record<string, string | null> = {
      core_educational_processing: null,
      online_learner_account: null,
      directory_information: null,
      third_party_sharing: null,
      photo_media_use: null,
    };
    await mockRpc(page, 'get_my_privacy_overview', () => privacyOverview(consents));
    await mockRpc(page, 'record_parental_consent', (payload: unknown) => {
      const p = payload as Record<string, string>;
      recorded.push(p);
      consents = { ...consents, [p.p_purpose as string]: p.p_decision as string };
      return { id: `c${recorded.length}`, purpose: p.p_purpose, decision: p.p_decision };
    });

    await page.goto('/parent/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Your decisions for Naledi Dube' }),
    ).toBeVisible();

    // No hidden defaults: nothing is checked and saving is disabled.
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    const save = page.getByRole('button', { name: 'Save and open the portal' });
    await expect(save).toBeDisabled();

    await page.getByText('I consent').first().click();
    await page.getByText('I do not consent').nth(1).click();
    // Granting requires a typed signature and the declaration.
    await expect(save).toBeDisabled();
    await page.getByLabel('Your full name (typed signature)').fill('Thandi Dube');
    await page.getByText(/I am Naledi Dube's parent or legal guardian/).click();
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByRole('heading', { name: 'Your decisions for Naledi Dube' })).toHaveCount(
      0,
    );
    expect(recorded).toHaveLength(2);
    expect(recorded.map((r) => r.p_decision).sort()).toEqual(['granted', 'refused']);
    expect(recorded.every((r) => r.p_method === 'in_app_attestation')).toBe(true);
  });
});

test.describe('Privacy & Records', () => {
  test('a guardian downloads the full record as JSON in one click', async ({ page }) => {
    await seedAuthenticatedSession(page, { role: 'guardian' });
    await installDataMocks(page, {
      profile: buildMockProfileRow({ role: 'guardian' }),
      school: buildMockSchoolRow(),
    });
    await mockRpc(
      page,
      'get_my_privacy_overview',
      privacyOverview({
        core_educational_processing: 'granted',
        online_learner_account: 'refused',
      }),
    );
    await mockRpc(page, 'get_learner_privacy_history', {
      access: [
        {
          at: '2026-09-29T10:00:00Z',
          type: 'view',
          role: 'principal',
          context: 'Staff learner profile — overview tab',
          by: 'Ada Principal',
        },
      ],
      disclosures: [],
    });
    await mockRpc(page, 'get_learner_record_package', {
      format: 'funda360.learner-record.v1',
      generated_at: '2026-09-30T08:00:00Z',
      school: { id: MOCK_TENANT_ID, name: 'Riverside Secondary School' },
      learner: { id: LEARNER_ID, first_name: 'Naledi', last_name: 'Dube' },
      enrollments: [],
      guardians: [],
      emergency_contacts: [],
      medical: null,
      attendance: [{ date: '2026-03-02', status: 'present', notes: null }],
      assessment_results: [],
      report_cards: [],
      behaviour: [],
      fees: { charges: [], payments: [] },
      documents: [],
      privacy: { consents: [], amendment_requests: [], disclosures: [] },
    });

    await page.goto('/parent/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy & Records' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Ada Principal' })).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('learner-record-naledi-dube-2026-09-30.json');
  });
});

test.describe('Public trust page', () => {
  test('is reachable without signing in and shows every compliance mark', async ({ page }) => {
    await page.goto('/trust');
    await expect(page.getByRole('heading', { name: 'POPIA + FERPA + GDPR ready.' })).toBeVisible();
    for (const title of [
      'POPIA Trust',
      'FERPA Shield',
      'GDPR Lock',
      'COPPA Consent',
      'CIPA Safe Content',
      'Encryption',
      'Role-Based Access',
      'Audit Logs',
      'Consent Workflow',
      'Data Portability',
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
    await expect(page.getByText(/It is not a certification/)).toBeVisible();
  });
});
