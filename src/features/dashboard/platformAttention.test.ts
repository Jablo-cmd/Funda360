import { describe, expect, it } from 'vitest';
import type { PlatformOverview } from '@/lib/database.types';
import { coverage, platformAttention } from './platformAttention';

function overview(
  overrides: Partial<{ [K in keyof PlatformOverview]: Partial<PlatformOverview[K]> }> = {},
): PlatformOverview {
  const base: PlatformOverview = {
    generated_at: '2026-10-24T10:00:00Z',
    schools: {
      total: 2,
      active: 2,
      pending: 0,
      suspended: 0,
      created_30d: 0,
      without_education_area: 0,
      list: [],
    },
    learners: { active: 10 },
    users: {
      total: 20,
      staff: 5,
      guardians: 13,
      learners: 0,
      platform: 2,
      signed_in_7d: 3,
      signed_in_30d: 6,
      demo_accounts: 0,
    },
    security: {
      privileged_accounts: 4,
      privileged_with_mfa: 4,
      platform_accounts: 2,
      platform_with_mfa: 2,
      platform_demo_accounts: 0,
      support_pending: 0,
      support_active: 0,
    },
    health: {
      latest_migration: '20261024091000',
      scheduled_job_failures_24h: 0,
      notifications_pending: 0,
      notifications_failed_7d: 0,
      unverified_payment_callbacks_7d: 0,
      ai_requests_7d: 0,
    },
    compliance: {
      open_data_requests: 0,
      overdue_data_requests: 0,
      open_amendment_requests: 0,
      open_content_safety_events: 0,
    },
    government: { education_areas: 0, active_official_assignments: 0, active_api_clients: 0 },
    recent_admin_actions: [],
  };
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = { ...(base as unknown as Record<string, object>)[key], ...(value as object) };
  }
  return merged as PlatformOverview;
}

describe('platformAttention', () => {
  it('is empty when nothing needs attention', () => {
    expect(platformAttention(overview())).toEqual([]);
  });

  it('puts missing platform MFA and platform demo accounts first', () => {
    const items = platformAttention(
      overview({
        security: {
          platform_with_mfa: 0,
          platform_demo_accounts: 1,
          privileged_with_mfa: 0,
          support_pending: 1,
        },
      }),
    );
    expect(items.map((i) => i.key)).toEqual([
      'platform-mfa',
      'platform-demo',
      'school-mfa',
      'support-pending',
    ]);
    expect(items[0]!.message).toBe('2 platform accounts without two-factor authentication.');
    expect(items[1]!.message).toBe('1 demo account still has platform-level access.');
    expect(items[2]!.message).toBe(
      '2 school leadership or finance accounts without two-factor authentication.',
    );
  });

  it('flags overdue requests, failed jobs, unverified callbacks and failed notifications', () => {
    const keys = platformAttention(
      overview({
        compliance: { overdue_data_requests: 1 },
        health: {
          scheduled_job_failures_24h: 2,
          unverified_payment_callbacks_7d: 3,
          notifications_failed_7d: 1,
        },
        schools: { pending: 1 },
      }),
    ).map((i) => i.key);
    expect(keys).toEqual([
      'dsar-overdue',
      'cron',
      'payment-callbacks',
      'notifications-failed',
      'schools-pending',
    ]);
  });
});

describe('coverage', () => {
  it('reports partial and full coverage', () => {
    expect(coverage(0, 2)).toEqual({ text: '0 of 2', complete: false });
    expect(coverage(2, 2)).toEqual({ text: '2 of 2', complete: true });
    expect(coverage(0, 0)).toEqual({ text: '—', complete: false });
  });
});
