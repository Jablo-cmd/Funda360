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
}

export function buildMockProfileRow(overrides: MockProfileOverrides = {}) {
  const {
    id = '11111111-1111-1111-1111-111111111111',
    tenantId = MOCK_TENANT_ID,
    firstName = 'Ada',
    lastName = 'Principal',
    email = 'admin@funda360.com',
  } = overrides;
  return {
    id,
    tenant_id: tenantId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: null,
    avatar_url: null,
    status: 'active',
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
