// Real Funda360 screens for the promo video, rendered from the production
// build with SYNTHETIC data. Every Supabase request is answered here; no
// request leaves the browser. All names are fictional.
//
//   cd video-production/capture
//   PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test -c capture.config.ts screens
//
// Output: ../assets/screens/*.png (1920 x 1080).

import { test, type Page, type Route } from '@playwright/test';
import { seedAuthenticatedSession } from '../../e2e/utils/mockAuth';
import {
  MOCK_TENANT_ID,
  buildMockAcademicYearRow,
  buildMockAssessmentRow,
  buildMockAttendanceRecordRow,
  buildMockClassRow,
  buildMockEmployeeRow,
  buildMockGradeRow,
  buildMockLearnerRow,
  buildMockProfileRow,
  buildMockSchoolRow,
  buildMockSubjectRow,
  buildMockTermRow,
} from '../../e2e/utils/mockData';

const OUT = '../assets/screens';
// A fixed school day (Thursday), so every screen shows a weekday.
const NOW = new Date('2026-10-15T09:30:00+02:00');
const TODAY = '2026-10-15';
const YEAR = 'year-2026';

const NAMES: [string, string, 'female' | 'male'][] = [
  ['Amahle', 'Ndlovu', 'female'],
  ['Pieter', 'van Wyk', 'male'],
  ['Lerato', 'Mokoena', 'female'],
  ['Thabo', 'Mahlangu', 'male'],
  ['Aisha', 'Patel', 'female'],
  ['Sipho', 'Khumalo', 'male'],
  ['Zanele', 'Dlamini', 'female'],
  ['Ethan', 'Jacobs', 'male'],
  ['Naledi', 'Molefe', 'female'],
  ['Kagiso', 'Sithole', 'male'],
  ['Chloé', 'du Plessis', 'female'],
  ['Lwazi', 'Mthembu', 'male'],
  ['Refilwe', 'Nkosi', 'female'],
  ['Yusuf', 'Adams', 'male'],
];

const grades = [8, 9, 10, 11, 12].map((g) => buildMockGradeRow({ id: `grade-${g}`, name: `Grade ${g}`, code: `G${g}`, sortOrder: g }));
const classes = [
  ['class-8a', 'grade-8', 'Grade 8A'],
  ['class-8b', 'grade-8', 'Grade 8B'],
  ['class-9a', 'grade-9', 'Grade 9A'],
  ['class-10a', 'grade-10', 'Grade 10A'],
  ['class-11a', 'grade-11', 'Grade 11A'],
  ['class-12a', 'grade-12', 'Grade 12A'],
].map(([id, gradeId, name]) => buildMockClassRow({ id, gradeId, name, capacity: 35 }));

const learners = NAMES.map(([first, last, gender], i) => ({
  ...buildMockLearnerRow({
    id: `learner-${i + 1}`,
    firstName: first,
    lastName: last,
    learnerNumber: `RV-2026-${String(101 + i).padStart(4, '0')}`,
    admissionNumber: `ADM-${String(2201 + i)}`,
  }),
  gender,
  date_of_birth: `20${11 + (i % 3)}-0${1 + (i % 9)}-1${i % 9}`,
}));

const enrollments = learners.map((l, i) => ({
  id: `enr-${i + 1}`,
  school_id: MOCK_TENANT_ID,
  learner_id: l.id,
  academic_year_id: YEAR,
  grade_id: 'grade-8',
  class_id: 'class-8a',
  enrollment_status: 'enrolled',
  enrollment_date: '2026-01-15',
  exit_date: null,
  exit_reason: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
}));

const STATUS = ['present', 'present', 'present', 'late', 'present', 'present', 'present', 'present', 'absent', 'present', 'present', 'present', 'present', 'present'] as const;
const attendance = learners.map((l, i) =>
  buildMockAttendanceRecordRow({ id: `att-${i}`, academicYearId: YEAR, classId: 'class-8a', learnerId: l.id, attendanceDate: TODAY, status: STATUS[i] }),
);
// 30 days of history for trend and rate views.
const history = Array.from({ length: 20 }, (_, d) => {
  const day = new Date(NOW.getTime() - (d + 1) * 86_400_000);
  if (day.getDay() === 0 || day.getDay() === 6) return [];
  const date = day.toISOString().slice(0, 10);
  return learners.map((l, i) =>
    buildMockAttendanceRecordRow({
      id: `h-${d}-${i}`,
      academicYearId: YEAR,
      classId: 'class-8a',
      learnerId: l.id,
      attendanceDate: date,
      status: (i + d) % 13 === 0 ? 'absent' : (i + d) % 11 === 0 ? 'late' : 'present',
    }),
  );
}).flat();

const employees = [
  ['Lindiwe', 'Mokoena', 'Principal'],
  ['Johan', 'Botha', 'Deputy Principal'],
  ['Nomsa', 'Zulu', 'Mathematics Educator'],
  ['Priya', 'Naidoo', 'English Educator'],
  ['David', 'Mensah', 'Life Sciences Educator'],
  ['Thandeka', 'Ngcobo', 'Finance Officer'],
  ['Marius', 'Pretorius', 'Admissions Officer'],
  ['Busisiwe', 'Radebe', 'Administrator'],
].map(([first, last, title], i) =>
  buildMockEmployeeRow({ id: `emp-${i + 1}`, firstName: first, lastName: last, jobTitle: title, employeeNumber: `EMP-${String(i + 1).padStart(3, '0')}` }),
);

const subjects = [
  ['subj-math', 'Mathematics'],
  ['subj-eng', 'English Home Language'],
  ['subj-ls', 'Life Sciences'],
].map(([id, name]) => buildMockSubjectRow({ id, name }));
const terms = [buildMockTermRow({ id: 'term-4', name: 'Term 4' })];
const assessments = [
  ['asmt-1', 'Algebra Test', 'subj-math', 'test'],
  ['asmt-2', 'Essay: Our Community', 'subj-eng', 'assignment'],
  ['asmt-3', 'Ecosystems Project', 'subj-ls', 'project'],
].map(([id, title, subjectId, type], i) =>
  buildMockAssessmentRow({
    id,
    title,
    subjectId,
    classId: 'class-8a',
    termId: 'term-4',
    academicYearId: YEAR,
    assessmentType: type as 'test',
    assessmentDate: new Date(NOW.getTime() - (i + 2) * 86_400_000).toISOString().slice(0, 10),
    maxMark: 50,
  }),
);

const charges = learners.map((l, i) => ({
  id: `charge-${i}`,
  school_id: MOCK_TENANT_ID,
  learner_id: l.id,
  academic_year_id: YEAR,
  fee_structure_id: null,
  description: 'Annual school fees 2026',
  category: 'tuition',
  amount: 9600,
  due_date: '2026-03-31',
  notes: null,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
}));
const payments = learners.flatMap((l, i) =>
  Array.from({ length: i % 5 === 4 ? 7 : 10 }, (_, m) => ({
    id: `pay-${i}-${m}`,
    school_id: MOCK_TENANT_ID,
    learner_id: l.id,
    academic_year_id: YEAR,
    amount: 960,
    payment_date: `2026-${String(m + 1).padStart(2, '0')}-05`,
    method: m % 3 === 0 ? 'cash' : 'eft',
    reference: `PAY-${i}-${m}`,
    notes: null,
    active: true,
    created_by: null,
    updated_by: null,
    created_at: `2026-${String(m + 1).padStart(2, '0')}-05T00:00:00Z`,
    updated_at: `2026-${String(m + 1).padStart(2, '0')}-05T00:00:00Z`,
  })),
);

const APPLICANTS: [string, string, string, string][] = [
  ['Mpho', 'Tshabalala', 'submitted', 'Grade 8'],
  ['Olivia', 'Smith', 'under_review', 'Grade 8'],
  ['Bongani', 'Zungu', 'interview_required', 'Grade 9'],
  ['Fatima', 'Ismail', 'accepted', 'Grade 8'],
  ['Kabelo', 'Moloi', 'waitlisted', 'Grade 10'],
  ['Ayanda', 'Cele', 'submitted', 'Grade 8'],
];
const applications = APPLICANTS.map(([first, last, status], i) => ({
  id: `app-${i + 1}`,
  school_id: MOCK_TENANT_ID,
  academic_year_id: YEAR,
  grade_id: i === 2 ? 'grade-9' : i === 4 ? 'grade-10' : 'grade-8',
  reference_number: `APP-2027-${String(141 + i).padStart(5, '0')}`,
  status,
  resume_token: null,
  applicant_first_name: 'Parent',
  applicant_last_name: last,
  applicant_email: `${last.toLowerCase()}@family.test`,
  applicant_phone: null,
  applicant_relationship: 'mother',
  learner_first_name: first,
  learner_last_name: last,
  learner_date_of_birth: '2014-05-01',
  learner_gender: null,
  learner_id_number: null,
  learner_nationality: 'South African',
  learner_home_language: 'English',
  prior_school: null,
  additional_notes: null,
  interview_at: null,
  assessment_at: null,
  decision_at: null,
  decision_by: null,
  decision_reason: null,
  converted_learner_id: null,
  submitted_at: `2026-10-0${i + 1}T09:00:00Z`,
  is_public_submission: true,
  created_by: null,
  updated_by: null,
  created_at: `2026-10-0${i + 1}T09:00:00Z`,
  updated_at: `2026-10-0${i + 1}T09:00:00Z`,
}));

const compliance = {
  generated_at: `${TODAY}T08:00:00Z`,
  school: { id: MOCK_TENANT_ID, name: 'Ridgeview Secondary School' },
  settings: {
    school_id: MOCK_TENANT_ID,
    frameworks: ['POPIA'],
    coppa_consent_age: 13,
    gdpr_digital_consent_age: 16,
    ferpa_amendment_response_days: 45,
    dsar_response_days: 30,
    content_filter_enabled: true,
    information_officer_name: 'B. Radebe',
    information_officer_email: 'privacy@ridgeview.test',
    privacy_notice_version: '2026-09',
    updated_by: null,
    updated_at: `${TODAY}T08:00:00Z`,
  },
  learners: { active: 14, minors: 14, under_coppa_age: 0, under_coppa_with_online_consent: 0, core_processing_decided: 14, online_accounts_without_consent: 0 },
  consents: { granted: 14, refused: 0, withdrawn: 0 },
  dsar: { open: 0, overdue: 0, completed_90d: 0 },
  amendments: { open: 0, overdue: 0, hearings_requested: 0 },
  disclosures_90d: 0,
  access_events_30d: 120,
  audit_events_30d: 340,
  content_safety: { active_rules: 6, open_events: 0, events_30d: 0 },
  mfa: { privileged_accounts: 3, privileged_with_mfa: 3 },
  rls: { tables: 125, forced: 125 },
};

const TABLES: Record<string, unknown[]> = {
  academic_years: [buildMockAcademicYearRow({ id: YEAR, isActive: true })],
  grades,
  classes,
  learners,
  learner_enrollments: enrollments,
  attendance_records: [...attendance, ...history],
  employees,
  subjects,
  terms,
  assessments,
  learner_fee_charges: charges,
  learner_fee_payments: payments,
  admission_applications: applications,
};

/** Minimal PostgREST filtering: eq / in / gte / lte on top-level columns. */
function applyFilters(rows: unknown[], params: URLSearchParams): unknown[] {
  let out = rows as Record<string, unknown>[];
  for (const [key, value] of params) {
    if (['select', 'order', 'limit', 'offset', 'or', 'and'].includes(key)) continue;
    const m = value.match(/^(eq|neq|in|gte|lte|gt|lt|is)\.(.*)$/);
    if (!m || !(out[0] && key in out[0])) continue;
    const [, op, raw] = m;
    out = out.filter((r) => {
      const v = r[key] == null ? null : String(r[key]);
      if (op === 'eq') return v === raw;
      if (op === 'neq') return v !== raw;
      if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, '')).includes(v ?? '');
      if (op === 'is') return raw === 'null' ? v === null : true;
      if (v === null) return false;
      if (op === 'gte') return v >= raw;
      if (op === 'lte') return v <= raw;
      if (op === 'gt') return v > raw;
      if (op === 'lt') return v < raw;
      return true;
    });
  }
  const limit = Number(params.get('limit') ?? 'NaN');
  return Number.isFinite(limit) ? out.slice(Number(params.get('offset') ?? 0), Number(params.get('offset') ?? 0) + limit) : out;
}

async function installSchool(page: Page) {
  await page.clock.setFixedTime(NOW);
  await seedAuthenticatedSession(page, {
    role: 'principal',
    aal: 'aal2',
    factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }],
  });
  const profile = buildMockProfileRow({ role: 'principal', firstName: 'Lindiwe', lastName: 'Mokoena' });
  const school = { ...buildMockSchoolRow({ name: 'Ridgeview Secondary School' }), email: 'info@ridgeview.test', website: null, principal_name: 'Lindiwe Mokoena' };
  await page.route('**/rest/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const name = url.pathname.replace(/^.*\/rest\/v1\//, '');
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const reply = (body: unknown, total?: number) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: total === undefined ? {} : { 'content-range': `0-${Math.max(total - 1, 0)}/${total}`, 'access-control-expose-headers': 'content-range' },
        body: JSON.stringify(body),
      });
    if (name === 'rpc/get_compliance_overview') return reply(compliance);
    if (name.startsWith('rpc/')) return reply(name === 'rpc/ai_my_features' ? [] : null);
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return reply([]);
    if (name === 'profiles') return reply(single ? profile : [profile], 1);
    if (name === 'schools') return reply(single ? school : [school], 1);
    const rows = TABLES[name];
    if (!rows) return reply(single ? null : [], 0);
    const all = applyFilters(rows, new URLSearchParams(url.searchParams));
    return reply(single ? (all[0] ?? null) : all, all.length);
  });
}

async function shoot(page: Page, path: string, file: string, waitFor?: string) {
  await page.goto(path);
  if (waitFor) await page.getByText(waitFor, { exact: false }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${file}.png` });
}

test('capture product screens', async ({ page }) => {
  await installSchool(page);
  await shoot(page, '/dashboard', '01-dashboard', 'Welcome back');
  await shoot(page, '/learners', '02-learners', 'Amahle');
  await page.goto('/attendance');
  await page.getByLabel('Class').selectOption({ label: 'Grade 8A' });
  await page.getByText('Amahle', { exact: false }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/03-attendance.png` });
  await shoot(page, '/fees', '04-finance', 'Finance Overview');
  await shoot(page, '/admissions', '05-admissions', 'Admissions');
  await shoot(page, '/reports/attendance', '06-reports', 'Attendance');
});
