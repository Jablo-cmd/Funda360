import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, installDataMocks } from './utils/mockData';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '55555555-5555-5555-5555-555555555555';
const CONV = 'conv-1';

function conversationRow() {
  return {
    id: CONV,
    school_id: 'tenant-demo',
    kind: 'direct',
    subject: 'Progress check',
    created_by: ME,
    last_message_at: '2026-09-07T10:00:00Z',
    message_count: 1,
    created_at: '2026-09-07T10:00:00Z',
  };
}

function messageRow(id: string, sender: string, body: string) {
  return {
    id,
    conversation_id: CONV,
    school_id: 'tenant-demo',
    sender_profile_id: sender,
    body,
    edited_at: null,
    deleted_at: null,
    created_at: '2026-09-07T10:00:00Z',
  };
}

test('a staff member starts a conversation and sees the message in the thread', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  const messages: ReturnType<typeof messageRow>[] = [];
  let started = false;

  await page.route('**/rest/v1/conversation_participants*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    if (url.searchParams.has('profile_id')) {
      return fulfillJson(route, started ? [{ conversation_id: CONV, last_read_at: null, archived: false, muted: false }] : []);
    }
    return fulfillJson(route, [
      { conversation_id: CONV, profile_id: ME, last_read_at: null, archived: false, muted: false, profiles: { id: ME, first_name: 'Teacher', last_name: 'A1' } },
      { conversation_id: CONV, profile_id: OTHER, last_read_at: null, archived: false, muted: false, profiles: { id: OTHER, first_name: 'Parent', last_name: 'A1' } },
    ]);
  });
  await page.route('**/rest/v1/conversations*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, started ? [conversationRow()] : []);
  });
  await page.route('**/rest/v1/messages*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, messages);
  });
  await page.route('**/rest/v1/message_attachments*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('status') || url.searchParams.has('or')) {
      return fulfillJson(route, [{ id: OTHER, first_name: 'Parent', last_name: 'A1', email: 'parent.a1@schoola.test', status: 'active' }]);
    }
    return fulfillJson(route, buildMockProfileRow({ role: 'teacher' }));
  });
  await page.route('**/rest/v1/rpc/start_conversation', async (route) => {
    started = true;
    messages.push(messageRow('m1', ME, 'Hello, could we discuss A1 progress?'));
    return fulfillJson(route, conversationRow());
  });
  await page.route('**/rest/v1/rpc/send_message', async (route) => {
    messages.push(messageRow(`m${messages.length + 1}`, ME, 'Follow-up note'));
    return fulfillJson(route, messages[messages.length - 1]);
  });
  await page.route('**/rest/v1/rpc/mark_conversation_read', async (route) => fulfillJson(route, null));

  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect(page.getByText('No conversations yet.')).toBeVisible();

  await page.getByRole('button', { name: 'New message' }).click();
  await page.getByLabel('Recipients').fill('Parent');
  await page.getByRole('button', { name: /Parent A1/ }).click();
  await page.getByRole('textbox', { name: 'Message' }).fill('Hello, could we discuss A1 progress?');
  await page.getByRole('button', { name: 'Send' }).click();

  // The message text appears both in the conversation-list preview and in
  // the open thread — assert on the thread copy (rendered last).
  await expect(page.getByText('Hello, could we discuss A1 progress?').last()).toBeVisible();
});

test('a guardian opens an existing conversation and replies', async ({ page }) => {
  const STAFF = 'staff-1';
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian', firstName: 'Parent', lastName: 'A1' }), school: buildMockSchoolRow() });

  const messages = [messageRow('m1', STAFF, 'Hello from the school')];

  await page.route('**/rest/v1/conversation_participants*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    if (url.searchParams.has('profile_id')) {
      return fulfillJson(route, [{ conversation_id: CONV, last_read_at: null, archived: false, muted: false }]);
    }
    return fulfillJson(route, [
      { conversation_id: CONV, profile_id: STAFF, last_read_at: null, archived: false, muted: false, profiles: { id: STAFF, first_name: 'Teacher', last_name: 'A1' } },
      { conversation_id: CONV, profile_id: ME, last_read_at: null, archived: false, muted: false, profiles: { id: ME, first_name: 'Parent', last_name: 'A1' } },
    ]);
  });
  await page.route('**/rest/v1/conversations*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, [conversationRow()]);
  });
  await page.route('**/rest/v1/messages*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, messages);
  });
  await page.route('**/rest/v1/message_attachments*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/rpc/send_message', async (route) => {
    messages.push(messageRow('m2', ME, 'Thank you'));
    return fulfillJson(route, messages[messages.length - 1]);
  });
  await page.route('**/rest/v1/rpc/mark_conversation_read', async (route) => fulfillJson(route, null));

  await page.goto('/parent/messages');
  await expect(page.getByText('Progress check').first()).toBeVisible();
  await page.getByRole('button', { name: /Progress check/ }).click();
  await expect(page.getByText('Hello from the school').last()).toBeVisible();

  await page.getByPlaceholder('Write a message…').fill('Thank you');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Thank you')).toBeVisible();
});

test('a user updates their notification preferences', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  let saved: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/notification_preferences*', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return fulfillJson(route, saved ?? null);
    }
    saved = { profile_id: ME, email_enabled: true, sms_enabled: false, whatsapp_enabled: false, type_overrides: {}, quiet_hours_start: null, quiet_hours_end: null, updated_at: '2026-09-07T10:00:00Z' };
    return fulfillJson(route, saved);
  });

  await page.goto('/notifications/settings');
  await expect(page.getByRole('heading', { name: 'Notification preferences' })).toBeVisible();
  await page.getByLabel('Email').check();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Notification preferences saved.')).toBeVisible();
  expect(saved).not.toBeNull();
});
