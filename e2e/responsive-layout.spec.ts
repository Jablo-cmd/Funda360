import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockAcademicYearRow,
  buildMockAttendanceRecordRow,
  buildMockClassRow,
  buildMockLearnerRow,
  buildMockProfileRow,
  buildMockSchoolRow,
  installAcademicListMock,
  installAttendanceRecordsMock,
  installDataMocks,
  installEmployeesListMock,
  installLearnersListMock,
  installReportRowsMock,
  installUsersListMock,
} from './utils/mockData';

/**
 * Layout regression guard for phones, tablets and desktops. The rule being
 * enforced: a page never scrolls sideways (only a deliberate table container
 * may), nothing pokes out of the viewport, and the mobile navigation behaves
 * like a proper dialog.
 */

const VIEWPORTS = [
  { name: '320 small phone', width: 320, height: 568 },
  { name: '390 phone', width: 390, height: 844 },
  { name: '768 tablet', width: 768, height: 1024 },
  { name: '1280 laptop', width: 1280, height: 800 },
] as const;

const LONG_NAME = 'Thandiwe-Nomvula Mahlangu-Sithole-Ramaphosa';
const LONG_SCHOOL = 'Riverside Secondary School of Excellence and Innovation';

async function signIn(page: Page, role: string) {
  await seedAuthenticatedSession(page, { role: role as 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: role as 'principal', firstName: LONG_NAME }),
    school: buildMockSchoolRow({ name: LONG_SCHOOL }),
    academicYears: [buildMockAcademicYearRow({ id: 'year-1', isActive: true })],
  });
  await installLearnersListMock(page, [
    buildMockLearnerRow(),
    buildMockLearnerRow({
      id: 'l2',
      firstName: LONG_NAME,
      lastName: 'Mahlangu-Sithole-Ramaphosa-Van-Der-Merwe',
    }),
  ]);
  await page.route('**/rest/v1/**', async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    if (/\/(profiles|schools|academic_years|learners)$/.test(pathname)) return route.fallback();
    return fulfillJson(route, []);
  });
}

/** Elements that stick out of the viewport horizontally, ignoring anything inside a scrolling container. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const de = document.documentElement;
    // A deliberate table scroller excuses what is inside it, but <main> never does: anything wider than <main> makes the whole page pan sideways on a phone.
    const inScroller = (el: Element) => {
      for (
        let p = el.parentElement;
        p && p !== document.body && p.tagName !== 'MAIN';
        p = p.parentElement
      ) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
      }
      return false;
    };
    const main = document.querySelector('main');
    const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;
    const offenders = Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (getComputedStyle(el).position === 'fixed') return false;
        if (el.closest('.sr-only, [aria-hidden="true"]')) return false;
        return (r.right > vw + 1 || r.left < -1) && !inScroller(el);
      })
      .map((el) => `${el.tagName.toLowerCase()}[${(el.textContent ?? '').trim().slice(0, 24)}]`)
      .slice(0, 5);
    return { pageOverflow: Math.max(de.scrollWidth - de.clientWidth, mainOverflow), offenders };
  });
}

const STAFF_ROUTES = [
  '/dashboard',
  '/learners',
  '/users',
  '/academic',
  '/fees',
  '/reports',
  '/attendance',
  '/transport',
  // Regressions found on real phones: hand-rolled page containers and header actions.
  '/users/x',
  '/my-profile',
  '/employees/x',
  '/academic/teaching-assignments',
  '/homework',
  '/guardians',
  '/fees/reconciliation',
];

// Guardians and learners use the app almost entirely on phones.
const PORTAL_ROUTES: [string, string][] = [
  ['guardian', '/parent/dashboard'],
  ['guardian', '/parent/children'],
  ['guardian', '/parent/fees'],
  ['guardian', '/parent/homework'],
  ['guardian', '/parent/messages'],
  ['guardian', '/parent/privacy'],
  ['learner', '/learner/dashboard'],
  ['learner', '/learner/timetable'],
  ['learner', '/learner/homework'],
  ['learner', '/learner/results'],
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of STAFF_ROUTES) {
      test(`${route} has no horizontal overflow`, async ({ page }) => {
        await signIn(page, 'principal');
        await page.goto(route);
        await expect(page.locator('main h1').first()).toBeVisible();
        const { pageOverflow, offenders } = await horizontalOverflow(page);
        expect(pageOverflow, `page scrolls sideways by ${pageOverflow}px`).toBeLessThanOrEqual(0);
        expect(offenders, `elements outside the viewport: ${offenders.join(', ')}`).toEqual([]);
      });
    }

    for (const [role, route] of PORTAL_ROUTES) {
      test(`${role} ${route} has no horizontal overflow`, async ({ page }) => {
        await signIn(page, role);
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const { pageOverflow, offenders } = await horizontalOverflow(page);
        expect(pageOverflow, `page scrolls sideways by ${pageOverflow}px`).toBeLessThanOrEqual(0);
        expect(offenders, `elements outside the viewport: ${offenders.join(', ')}`).toEqual([]);
      });
    }
  });
}

test.describe('phone navigation drawer', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('opens as a dialog, closes on Escape and returns focus to the menu button', async ({
    page,
  }) => {
    await signIn(page, 'principal');
    await page.goto('/dashboard');
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await menuButton.click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    // Fully inside the screen and never wider than 85% of it.
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360 * 0.85 + 1);

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test('closes when a destination is chosen, and when the route changes by other means', async ({
    page,
  }) => {
    await signIn(page, 'principal');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('dialog', { name: 'Menu' })
      .getByRole('link', { name: 'Learners' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/learners/);
    await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
  });

  test('keeps Tab focus inside the open drawer', async ({ page }) => {
    await signIn(page, 'principal');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inside = await drawer.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }
  });

  test('the footer scrolls with the page instead of taking screen height permanently', async ({
    page,
  }) => {
    await signIn(page, 'principal');
    await page.goto('/dashboard');
    await expect(page.locator('main h1').first()).toBeVisible();
    const persistentFooter = page.locator('body > div > footer, #root > div > footer');
    await expect(persistentFooter.filter({ visible: true })).toHaveCount(0);
    await expect(page.locator('main footer')).toHaveCount(1);
  });
});

test.describe('dialogs on a small phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the Add learner dialog fits the screen, scrolls inside itself and keeps its close button reachable', async ({
    page,
  }) => {
    await signIn(page, 'principal');
    await page.goto('/learners');
    await page.getByRole('button', { name: /add learner/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320 + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(568 + 1);
    const close = dialog.getByRole('button', { name: 'Close' });
    await expect(close).toBeInViewport();
    const size = await close.boundingBox();
    expect(Math.min(size!.width, size!.height)).toBeGreaterThanOrEqual(44);
    // Phone form fields are 16px so iOS does not zoom the page on focus.
    const fontSizes = await dialog
      .locator('input:not([type=checkbox]):not([type=radio]), select, textarea')
      .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(16);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('typing in a dialog keeps focus on the field being edited', async ({ page }) => {
    await signIn(page, 'principal');
    await page.goto('/learners');
    await page.getByRole('button', { name: /add learner/i }).click();
    const dialog = page.getByRole('dialog');
    const fields = dialog.getByRole('textbox');
    await fields.nth(1).focus();
    await page.keyboard.type('Thandiwe');
    await expect(fields.nth(1)).toBeFocused();
    await expect(fields.nth(1)).toHaveValue('Thandiwe');
  });
});

test.describe('phone-specific fixes', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the attendance trend chart is drawn at its real width so axis text stays readable', async ({
    page,
  }) => {
    await seedAuthenticatedSession(page, { role: 'principal' });
    await installDataMocks(page, {
      profile: buildMockProfileRow(),
      school: buildMockSchoolRow(),
      academicYears: [buildMockAcademicYearRow()],
    });
    await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
    await installAttendanceRecordsMock(
      page,
      Array.from({ length: 14 }, (_, i) =>
        buildMockAttendanceRecordRow({
          id: `a${i}`,
          learnerId: 'learner-1',
          attendanceDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
          status: i % 3 === 0 ? 'absent' : 'present',
        }),
      ),
    );
    await installReportRowsMock(page, 'learners', [
      buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' }),
    ]);
    await installLearnersListMock(page, []);
    await installEmployeesListMock(page, []);
    await installUsersListMock(page, [buildMockProfileRow()]);

    await page.goto('/reports/attendance');
    const chart = page.getByRole('img', { name: /Attendance rate trend/ });
    await expect(chart).toBeVisible();
    const { svgWidth, containerWidth, axisFontPx } = await chart.evaluate((svg) => {
      const text = svg.querySelector('text') as SVGTextElement;
      const scale = (svg as unknown as SVGSVGElement).getScreenCTM()?.a ?? 1;
      return {
        svgWidth: svg.getBoundingClientRect().width,
        containerWidth: (svg.parentElement as HTMLElement).getBoundingClientRect().width,
        axisFontPx: parseFloat(getComputedStyle(text).fontSize) * scale,
      };
    });
    expect(Math.abs(svgWidth - containerWidth)).toBeLessThanOrEqual(1);
    expect(axisFontPx).toBeGreaterThanOrEqual(10.5);
    await expect(page.getByText(/attention line/)).toBeVisible();
  });

  test('the schools list shows every school with its switch action on screen, no sideways swipe', async ({
    page,
  }) => {
    await seedAuthenticatedSession(page, { role: 'super_administrator' });
    await installDataMocks(page, {
      profile: buildMockProfileRow({ role: 'super_administrator', tenantId: null }),
      school: buildMockSchoolRow(),
    });
    const names = [
      'Riverside Secondary School of Excellence and Innovation',
      'St. Bartholomew-Mandela Comprehensive Combined School and Early Learning Centre',
    ];
    await page.route('**/rest/v1/schools*', async (route: Route) => {
      const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
      const list = names.map((name, i) => buildMockSchoolRow({ id: `school-${i}`, name }));
      return fulfillJson(route, single ? list[0] : list);
    });
    await page.goto('/schools');
    const switchButtons = page.getByRole('button', { name: 'Switch to this school' });
    await expect(switchButtons).toHaveCount(2);
    for (const button of await switchButtons.all()) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }
    const { pageOverflow } = await horizontalOverflow(page);
    expect(pageOverflow).toBeLessThanOrEqual(0);
  });
});

test('the public trust page stays readable when the visitor has the dark theme saved', async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem('funda360-theme', 'dark'));
  await page.goto('/trust');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});
