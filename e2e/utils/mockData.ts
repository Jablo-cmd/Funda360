import type { Page, Route } from '@playwright/test';
import { fulfillJson } from './mockAuth';

export const MOCK_TENANT_ID = 'tenant-demo';

interface MockSchoolOverrides {
  id?: string;
  name?: string;
  status?: 'pending' | 'active' | 'inactive' | 'suspended';
}

export function buildMockSchoolRow(overrides: MockSchoolOverrides = {}) {
  const { id = MOCK_TENANT_ID, name = 'Riverside Secondary School', status = 'active' } = overrides;
  return {
    id,
    name,
    registration_number: 'GDE-2024-00123',
    education_department: 'Gauteng Department of Education',
    school_type: 'public',
    province: 'Gauteng',
    district: 'Johannesburg Central',
    emis_number: '700101234',
    email: 'info@riverside.funda360.dev',
    phone: '+27 11 555 0100',
    website: 'https://riverside.funda360.dev',
    logo_url: null,
    physical_address: '12 River Road, Johannesburg, 2001',
    postal_address: 'PO Box 456, Johannesburg, 2000',
    principal_name: 'Thabo Nkosi',
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
    language: 'en',
    status,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

interface MockProfileOverrides {
  id?: string;
  tenantId?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  role?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
}

export function buildMockProfileRow(overrides: MockProfileOverrides = {}) {
  const {
    id = '11111111-1111-1111-1111-111111111111',
    tenantId = MOCK_TENANT_ID,
    firstName = 'Ada',
    lastName = 'Principal',
    email = 'admin@funda360.com',
    phone = null,
    role = 'principal',
    status = 'active',
  } = overrides;
  return {
    id,
    tenant_id: tenantId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    avatar_url: null,
    role,
    status,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

interface MockAcademicYearOverrides {
  id?: string;
  schoolId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export function buildMockAcademicYearRow(overrides: MockAcademicYearOverrides = {}) {
  const {
    id = 'year-2026',
    schoolId = MOCK_TENANT_ID,
    name = '2026 Academic Year',
    startDate = '2026-01-15',
    endDate = '2026-12-05',
    isActive = true,
  } = overrides;
  return {
    id,
    school_id: schoolId,
    name,
    start_date: startDate,
    end_date: endDate,
    is_active: isActive,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockGradeOverrides {
  id?: string;
  schoolId?: string;
  name?: string;
  code?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export function buildMockGradeRow(overrides: MockGradeOverrides = {}) {
  const { id = 'grade-8', schoolId = MOCK_TENANT_ID, name = 'Grade 8', code = 'G8', sortOrder = 8, active = true } = overrides;
  return {
    id,
    school_id: schoolId,
    name,
    code,
    description: null,
    sort_order: sortOrder,
    active,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockClassOverrides {
  id?: string;
  gradeId?: string;
  schoolId?: string;
  name?: string;
  capacity?: number;
  active?: boolean;
}

export function buildMockClassRow(overrides: MockClassOverrides = {}) {
  const { id = 'class-8a', gradeId = 'grade-8', schoolId = MOCK_TENANT_ID, name = 'Grade 8A', capacity = 32, active = true } = overrides;
  return {
    id,
    grade_id: gradeId,
    school_id: schoolId,
    name,
    capacity,
    active,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockSubjectOverrides {
  id?: string;
  schoolId?: string;
  name?: string;
  code?: string | null;
  active?: boolean;
}

export function buildMockSubjectRow(overrides: MockSubjectOverrides = {}) {
  const { id = 'subject-math', schoolId = MOCK_TENANT_ID, name = 'Mathematics', code = 'MATH', active = true } = overrides;
  return {
    id,
    school_id: schoolId,
    name,
    code,
    description: null,
    active,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockTermOverrides {
  id?: string;
  academicYearId?: string;
  schoolId?: string;
  name?: string;
  sequence?: number;
  active?: boolean;
}

export function buildMockTermRow(overrides: MockTermOverrides = {}) {
  const {
    id = 'term-1',
    academicYearId = 'year-2026',
    schoolId = MOCK_TENANT_ID,
    name = 'Term 1',
    sequence = 1,
    active = true,
  } = overrides;
  return {
    id,
    academic_year_id: academicYearId,
    school_id: schoolId,
    name,
    sequence,
    start_date: '2026-01-15',
    end_date: '2026-04-01',
    active,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

/** Mocks a `.from('<table>').select('*').eq(...)` LIST query (GET, no `limit`/`offset` params — see installUsersListMock for that shape) for one of the academic tables. */
export async function installAcademicListMock(
  page: Page,
  table: 'academic_years' | 'terms' | 'grades' | 'classes' | 'subjects',
  rows: Record<string, unknown>[],
) {
  await page.route(`**/rest/v1/${table}*`, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, rows);
  });
}

/** Mocks a `.rpc('set_active_academic_year', ...)` call. */
export async function installSetActiveAcademicYearMock(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route('**/rest/v1/rpc/set_active_academic_year', handler);
}

/**
 * Mocks the PostgREST endpoints ProfileProvider/TenantProvider call after
 * sign-in. Pass `null` for a table to simulate "no row found" (maybeSingle
 * resolving to null) instead of omitting the mock entirely.
 *
 * Also always intercepts the `academic_years` list query AcademicProvider
 * issues as soon as a school resolves (it's mounted unconditionally at the
 * app root, inside SchoolProvider — see App.tsx) — defaults to an empty
 * list unless a test overrides it via `academicYears`, so every existing
 * test that resolves a real school doesn't need to know about the Academic
 * feature just to avoid an unmocked request falling through to the real
 * network.
 */
export async function installDataMocks(
  page: Page,
  data: {
    profile?: ReturnType<typeof buildMockProfileRow> | null;
    school?: ReturnType<typeof buildMockSchoolRow> | null;
    academicYears?: ReturnType<typeof buildMockAcademicYearRow>[];
  },
) {
  await page.route('**/rest/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/profiles')) {
      if (data.profile === undefined) return route.continue();
      return data.profile === null ? fulfillJson(route, null) : fulfillJson(route, data.profile);
    }

    if (url.pathname.endsWith('/schools')) {
      if (data.school === undefined) return route.continue();
      return data.school === null ? fulfillJson(route, null) : fulfillJson(route, data.school);
    }

    if (url.pathname.endsWith('/academic_years') && route.request().method() === 'GET') {
      return fulfillJson(route, data.academicYears ?? []);
    }

    return route.continue();
  });
}

/**
 * Mocks the `profiles` LIST query the Users directory issues (identified by
 * `limit`/`offset` params, since a single-row lookup instead filters by
 * `id`). Also sets `Access-Control-Expose-Headers` — Content-Range is not a
 * browser-safelisted response header, so without it supabase-js can't read
 * the row count back out even though the header is present (verified while
 * building this: the count silently came back as 0/null without it).
 */
export async function installUsersListMock(page: Page, users: ReturnType<typeof buildMockProfileRow>[]) {
  await page.route('**/rest/v1/profiles*', async (route: Route) => {
    const url = new URL(route.request().url());
    const isListQuery = url.searchParams.has('limit') || url.searchParams.has('offset');
    if (!isListQuery) return route.fallback();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': `0-${Math.max(users.length - 1, 0)}/${users.length}`,
        'access-control-expose-headers': 'content-range',
      },
      body: JSON.stringify(users),
    });
  });
}

/** Mocks a `.rpc('admin_create_user' | 'admin_update_user_role', ...)` call. */
export async function installRpcMock(
  page: Page,
  fnName: 'admin_create_user' | 'admin_update_user_role',
  handler: (route: Route) => Promise<void>,
) {
  await page.route(`**/rest/v1/rpc/${fnName}`, handler);
}

interface MockLearnerOverrides {
  id?: string;
  schoolId?: string;
  learnerNumber?: string;
  admissionNumber?: string;
  firstName?: string;
  lastName?: string;
  idNumber?: string | null;
  status?: string;
}

export function buildMockLearnerRow(overrides: MockLearnerOverrides = {}) {
  const {
    id = 'learner-1',
    schoolId = MOCK_TENANT_ID,
    learnerNumber = 'LRN-0001',
    admissionNumber = 'ADM-0001',
    firstName = 'Naledi',
    lastName = 'Dube',
    idNumber = null,
    status = 'active',
  } = overrides;
  return {
    id,
    school_id: schoolId,
    profile_id: null,
    learner_number: learnerNumber,
    admission_number: admissionNumber,
    first_name: firstName,
    last_name: lastName,
    preferred_name: null,
    gender: 'female',
    date_of_birth: '2012-03-14',
    id_number: idNumber,
    passport_number: null,
    passport_country: null,
    nationality: 'South African',
    home_language: 'English',
    additional_languages: null,
    photo_url: null,
    transport_mode: null,
    transport_notes: null,
    boarding_type: 'day_scholar',
    status,
    status_reason: null,
    admission_date: '2026-01-15',
    created_by: null,
    updated_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockEnrollmentOverrides {
  id?: string;
  schoolId?: string;
  learnerId?: string;
  academicYearId?: string;
  gradeId?: string;
  classId?: string | null;
  enrollmentStatus?: string;
}

export function buildMockLearnerEnrollmentRow(overrides: MockEnrollmentOverrides = {}) {
  const {
    id = 'enrollment-1',
    schoolId = MOCK_TENANT_ID,
    learnerId = 'learner-1',
    academicYearId = 'year-2026',
    gradeId = 'grade-8',
    classId = 'class-8a',
    enrollmentStatus = 'enrolled',
  } = overrides;
  return {
    id,
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: academicYearId,
    grade_id: gradeId,
    class_id: classId,
    house: null,
    stream: null,
    enrollment_date: '2026-01-15',
    enrollment_status: enrollmentStatus,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockGuardianOverrides {
  id?: string;
  schoolId?: string;
  learnerId?: string;
  guardianProfileId?: string;
  relationshipType?: string;
  isPrimary?: boolean;
}

export function buildMockLearnerGuardianRow(overrides: MockGuardianOverrides = {}) {
  const {
    id = 'guardian-1',
    schoolId = MOCK_TENANT_ID,
    learnerId = 'learner-1',
    guardianProfileId = 'guardian-profile-1',
    relationshipType = 'mother',
    isPrimary = true,
  } = overrides;
  return {
    id,
    school_id: schoolId,
    learner_id: learnerId,
    guardian_profile_id: guardianProfileId,
    relationship_type: relationshipType,
    is_primary: isPrimary,
    custody_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockEmergencyContactOverrides {
  id?: string;
  schoolId?: string;
  learnerId?: string;
  name?: string;
  phone?: string;
}

export function buildMockLearnerEmergencyContactRow(overrides: MockEmergencyContactOverrides = {}) {
  const {
    id = 'contact-1',
    schoolId = MOCK_TENANT_ID,
    learnerId = 'learner-1',
    name = 'Zanele Dube',
    phone = '+27 82 555 0101',
  } = overrides;
  return {
    id,
    school_id: schoolId,
    learner_id: learnerId,
    name,
    relationship: 'Aunt',
    phone,
    alternate_phone: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockMedicalInformationOverrides {
  id?: string;
  schoolId?: string;
  learnerId?: string;
  allergies?: string | null;
}

export function buildMockLearnerMedicalInformationRow(overrides: MockMedicalInformationOverrides = {}) {
  const { id = 'medical-1', schoolId = MOCK_TENANT_ID, learnerId = 'learner-1', allergies = 'Peanuts' } = overrides;
  return {
    id,
    school_id: schoolId,
    learner_id: learnerId,
    allergies,
    medication: null,
    medical_conditions: null,
    doctor_name: null,
    doctor_phone: null,
    medical_aid_provider: null,
    medical_aid_number: null,
    emergency_medical_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockDocumentOverrides {
  id?: string;
  schoolId?: string;
  learnerId?: string;
  documentType?: string;
  active?: boolean;
}

export function buildMockLearnerDocumentRow(overrides: MockDocumentOverrides = {}) {
  const {
    id = 'document-1',
    schoolId = MOCK_TENANT_ID,
    learnerId = 'learner-1',
    documentType = 'birth_certificate',
    active = true,
  } = overrides;
  return {
    id,
    school_id: schoolId,
    learner_id: learnerId,
    document_type: documentType,
    file_url: 'https://files.funda360.dev/docs/birth-certificate.pdf',
    file_name: 'birth-certificate.pdf',
    uploaded_at: '2026-01-01T00:00:00Z',
    notes: null,
    active,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

/**
 * Mocks the `learners` LIST query (paginated like `profiles` — identified by
 * `limit`/`offset` params, see installUsersListMock for why Content-Range
 * needs `access-control-expose-headers`).
 */
export async function installLearnersListMock(page: Page, learners: ReturnType<typeof buildMockLearnerRow>[]) {
  await page.route('**/rest/v1/learners*', async (route: Route) => {
    const url = new URL(route.request().url());
    const isListQuery = url.searchParams.has('limit') || url.searchParams.has('offset');
    if (!isListQuery) return route.fallback();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': `0-${Math.max(learners.length - 1, 0)}/${learners.length}`,
        'access-control-expose-headers': 'content-range',
      },
      body: JSON.stringify(learners),
    });
  });
}

/** Mocks the single-learner `.eq('id', ...).maybeSingle()` fetch (GET, no `limit`/`offset` params) LearnerProfilePage issues. */
export async function installLearnerDetailMock(page: Page, learner: ReturnType<typeof buildMockLearnerRow> | null) {
  await page.route('**/rest/v1/learners*', async (route: Route) => {
    const url = new URL(route.request().url());
    const isListQuery = url.searchParams.has('limit') || url.searchParams.has('offset');
    if (isListQuery) return route.fallback();
    await fulfillJson(route, learner);
  });
}

/** Mocks a `.from('<table>').select('*').eq(...)` LIST query (GET, unpaginated) for one of the learner child tables. */
export async function installLearnerChildListMock(
  page: Page,
  table: 'learner_enrollments' | 'learner_guardians' | 'learner_emergency_contacts' | 'learner_documents',
  rows: Record<string, unknown>[],
) {
  await page.route(`**/rest/v1/${table}*`, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, rows);
  });
}

/** Mocks the `learner_medical_information` `.eq('learner_id', ...).maybeSingle()` fetch MedicalInformationCard issues. */
export async function installLearnerMedicalInformationMock(
  page: Page,
  record: ReturnType<typeof buildMockLearnerMedicalInformationRow> | null,
) {
  await page.route('**/rest/v1/learner_medical_information*', async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, record);
  });
}

/** Mocks a `.rpc('change_learner_status' | 'promote_learner', ...)` call. */
export async function installLearnerRpcMock(
  page: Page,
  fnName: 'change_learner_status' | 'promote_learner',
  handler: (route: Route) => Promise<void>,
) {
  await page.route(`**/rest/v1/rpc/${fnName}`, handler);
}

interface MockDepartmentOverrides {
  id?: string;
  schoolId?: string;
  name?: string;
  code?: string | null;
  active?: boolean;
}

export function buildMockDepartmentRow(overrides: MockDepartmentOverrides = {}) {
  const {
    id = 'department-hr',
    schoolId = MOCK_TENANT_ID,
    name = 'Human Resources',
    code = 'HR',
    active = true,
  } = overrides;
  return {
    id,
    school_id: schoolId,
    name,
    code,
    description: null,
    active,
    created_by: null,
    updated_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

interface MockEmployeeOverrides {
  id?: string;
  schoolId?: string;
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
  jobTitle?: string | null;
  employmentStatus?: string;
  reportsToEmployeeId?: string | null;
  workEmail?: string | null;
  profileId?: string | null;
}

export function buildMockEmployeeRow(overrides: MockEmployeeOverrides = {}) {
  const {
    id = 'employee-1',
    schoolId = MOCK_TENANT_ID,
    employeeNumber = 'EMP-0001',
    firstName = 'Karabo',
    lastName = 'Mokoena',
    departmentId = 'department-hr',
    jobTitle = 'HR Officer',
    employmentStatus = 'active',
    reportsToEmployeeId = null,
    workEmail = 'karabo.mokoena@riverside.funda360.dev',
    profileId = null,
  } = overrides;
  return {
    id,
    school_id: schoolId,
    profile_id: profileId,
    employee_number: employeeNumber,
    first_name: firstName,
    last_name: lastName,
    work_email: workEmail,
    work_phone: '+27 11 555 0199',
    id_number: null,
    date_of_birth: null,
    department_id: departmentId,
    job_title: jobTitle,
    employment_type: 'full_time',
    employment_status: employmentStatus,
    hire_date: '2024-02-01',
    termination_date: null,
    reports_to_employee_id: reportsToEmployeeId,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

/** Mocks the `departments` LIST query (GET, unpaginated — a small bounded catalogue, same shape as installAcademicListMock). */
export async function installDepartmentsListMock(page: Page, departments: ReturnType<typeof buildMockDepartmentRow>[]) {
  await page.route('**/rest/v1/departments*', async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, departments);
  });
}

/**
 * Mocks the `employees` LIST query (paginated like `profiles`/`learners`).
 * Identified by the `offset` param specifically (not `limit`/`offset`, the
 * shape used elsewhere) — `employees` uniquely also has a `.limit()`-only
 * caller (searchEmployeeCandidates, see installEmployeeCandidatesMock)
 * hitting the same table, which `.limit()` alone sets `limit` without
 * `offset` for (see PostgrestTransformBuilder: `.range()` sets both,
 * `.limit()` sets only `limit`) — checking `offset` alone keeps the two
 * mocks from colliding.
 */
export async function installEmployeesListMock(page: Page, employees: ReturnType<typeof buildMockEmployeeRow>[]) {
  await page.route('**/rest/v1/employees*', async (route: Route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('offset')) return route.fallback();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': `0-${Math.max(employees.length - 1, 0)}/${employees.length}`,
        'access-control-expose-headers': 'content-range',
      },
      body: JSON.stringify(employees),
    });
  });
}

/** Mocks the single-employee `.eq('id', ...).maybeSingle()` fetch (GET, no `limit`/`offset` params) EmployeeProfilePage issues. */
export async function installEmployeeDetailMock(page: Page, employee: ReturnType<typeof buildMockEmployeeRow> | null) {
  await page.route('**/rest/v1/employees*', async (route: Route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.searchParams.has('offset') || url.searchParams.has('limit')) {
      return route.fallback();
    }
    await fulfillJson(route, employee);
  });
}

/** Mocks the `.limit(20)` candidate search (GET, `limit` present without `offset`) EmployeeFormModal's "reports to" picker issues. */
export async function installEmployeeCandidatesMock(
  page: Page,
  candidates: { id: string; first_name: string; last_name: string }[],
) {
  await page.route('**/rest/v1/employees*', async (route: Route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('limit') || url.searchParams.has('offset')) {
      return route.fallback();
    }
    await fulfillJson(route, candidates);
  });
}

/** Mocks a `.rpc('terminate_employee' | 'reactivate_employee' | 'provision_employee_login', ...)` call. */
export async function installEmployeeRpcMock(
  page: Page,
  fnName: 'terminate_employee' | 'reactivate_employee' | 'provision_employee_login',
  handler: (route: Route) => Promise<void>,
) {
  await page.route(`**/rest/v1/rpc/${fnName}`, handler);
}
