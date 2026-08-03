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

/**
 * Mocks the PostgREST endpoints ProfileProvider/TenantProvider call after
 * sign-in. Pass `null` for a table to simulate "no row found" (maybeSingle
 * resolving to null) instead of omitting the mock entirely.
 */
export async function installDataMocks(
  page: Page,
  data: { profile?: ReturnType<typeof buildMockProfileRow> | null; school?: ReturnType<typeof buildMockSchoolRow> | null },
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
