import type { Page, Route } from '@playwright/test';

export const MOCK_USER_ID = '11111111-1111-1111-1111-111111111111';

interface MockUserOverrides {
  email?: string;
  emailConfirmed?: boolean;
  role?: string;
}

export function buildMockUser(overrides: MockUserOverrides = {}) {
  const { email = 'admin@funda360.com', emailConfirmed = true, role = 'principal' } = overrides;
  return {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: emailConfirmed ? '2024-01-01T00:00:00Z' : null,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'], role, tenant_id: 'tenant-demo' },
    user_metadata: {},
    identities: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

export function buildMockSession(overrides: MockUserOverrides = {}) {
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: buildMockUser(overrides),
  };
}

/** Fulfils a Supabase auth-js JSON success response. */
export async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** Fulfils a Supabase auth-js error response (auth-js reads `error_code` + `msg`). */
export async function fulfillAuthError(route: Route, errorCode: string, message: string, status = 400) {
  await fulfillJson(route, { error_code: errorCode, msg: message, code: status }, status);
}

/**
 * Installs handlers for the GoTrue endpoints the app calls. Pass only the
 * handlers a given test needs — unmatched auth requests fall through to a
 * generic 200 `{}` so unrelated calls (e.g. settings probes) don't hang the
 * test.
 */
export async function installAuthMocks(
  page: Page,
  handlers: Partial<Record<'token' | 'logout' | 'recover' | 'user' | 'resend', (route: Route) => Promise<void>>>,
) {
  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname.endsWith('/token') && method === 'POST' && handlers.token) {
      return handlers.token(route);
    }
    if (url.pathname.endsWith('/logout') && handlers.logout) {
      return handlers.logout(route);
    }
    if (url.pathname.endsWith('/recover') && handlers.recover) {
      return handlers.recover(route);
    }
    if (url.pathname.endsWith('/resend') && handlers.resend) {
      return handlers.resend(route);
    }
    if (url.pathname.endsWith('/user') && method === 'PUT' && handlers.user) {
      return handlers.user(route);
    }

    return fulfillJson(route, {});
  });
}

/** Seeds localStorage with an already-authenticated Supabase session before the app boots. */
export async function seedAuthenticatedSession(page: Page, overrides: MockUserOverrides = {}) {
  const session = buildMockSession(overrides);
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['funda360-auth', JSON.stringify(session)],
  );
}
