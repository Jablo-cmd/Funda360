import { test, expect } from '@playwright/test';
import { buildMockSession, fulfillAuthError, fulfillJson, installAuthMocks } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

test('redirects an unauthenticated visitor from "/" to "/login"', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
});

test('shows validation errors when submitting an empty form', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Email is required')).toBeVisible();
  await expect(page.getByText('Password is required')).toBeVisible();
});

test('shows a friendly error for invalid credentials', async ({ page }) => {
  await installAuthMocks(page, {
    token: (route) => fulfillAuthError(route, 'invalid_credentials', 'Invalid login credentials'),
  });

  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@funda360.com');
  await page.locator('#password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
  await expect(page).toHaveURL(/\/login$/);
});

test('signs in successfully, reaches the protected home, and signs out', async ({ page }) => {
  await installAuthMocks(page, {
    token: (route) => fulfillJson(route, buildMockSession()),
    logout: (route) => fulfillJson(route, {}, 204),
  });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
  });

  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@funda360.com');
  await page.locator('#password').fill('correct-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByRole('heading', { name: "You're signed in" })).toBeVisible();
  await expect(page.getByText('Ada Principal')).toBeVisible();
  await expect(page.getByText('principal', { exact: true })).toBeVisible();
  await expect(page.getByText('Riverside Secondary School')).toBeVisible();
  await expect(page.getByText('ready')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('toggles password visibility', async ({ page }) => {
  await page.goto('/login');
  const passwordInput = page.locator('#password');
  await passwordInput.fill('supersecret123');

  await expect(passwordInput).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(passwordInput).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(passwordInput).toHaveAttribute('type', 'password');
});

