import type { PlatformOverview } from '@/lib/database.types';

export interface AttentionItem {
  key: string;
  severity: 'high' | 'medium';
  message: string;
  to: string;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * What the platform owner should act on, most serious first. Derived only
 * from the overview's counts; an empty list means nothing needs attention.
 */
export function platformAttention(overview: PlatformOverview): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { security, health, compliance, schools } = overview;

  const platformWithoutMfa = security.platform_accounts - security.platform_with_mfa;
  if (platformWithoutMfa > 0) {
    items.push({
      key: 'platform-mfa',
      severity: 'high',
      message: `${plural(platformWithoutMfa, 'platform account')} without two-factor authentication.`,
      to: '/my-profile#mfa-security',
    });
  }
  if (security.platform_demo_accounts > 0) {
    items.push({
      key: 'platform-demo',
      severity: 'high',
      message: `${plural(security.platform_demo_accounts, 'demo account')} still ${security.platform_demo_accounts === 1 ? 'has' : 'have'} platform-level access.`,
      to: '/users',
    });
  }
  if (compliance.overdue_data_requests > 0) {
    items.push({
      key: 'dsar-overdue',
      severity: 'high',
      message: `${plural(compliance.overdue_data_requests, 'data subject request')} past the legal deadline.`,
      to: '/schools',
    });
  }
  if ((health.scheduled_job_failures_24h ?? 0) > 0) {
    items.push({
      key: 'cron',
      severity: 'high',
      message: `${plural(health.scheduled_job_failures_24h ?? 0, 'scheduled job')} failed in the last 24 hours.`,
      to: '/dashboard',
    });
  }
  const privilegedWithoutMfa = security.privileged_accounts - security.privileged_with_mfa;
  if (privilegedWithoutMfa > platformWithoutMfa) {
    items.push({
      key: 'school-mfa',
      severity: 'medium',
      message: `${plural(privilegedWithoutMfa - platformWithoutMfa, 'school leadership or finance account')} without two-factor authentication.`,
      to: '/users',
    });
  }
  if (security.support_pending > 0) {
    items.push({
      key: 'support-pending',
      severity: 'medium',
      message: `${plural(security.support_pending, 'support access request')} waiting for a school's decision.`,
      to: '/support-access',
    });
  }
  if (health.unverified_payment_callbacks_7d > 0) {
    items.push({
      key: 'payment-callbacks',
      severity: 'medium',
      message: `${plural(health.unverified_payment_callbacks_7d, 'unverified payment callback')} in the last 7 days.`,
      to: '/dashboard',
    });
  }
  if (health.notifications_failed_7d > 0) {
    items.push({
      key: 'notifications-failed',
      severity: 'medium',
      message: `${plural(health.notifications_failed_7d, 'email or SMS notification')} failed in the last 7 days.`,
      to: '/dashboard',
    });
  }
  if (schools.pending > 0) {
    items.push({
      key: 'schools-pending',
      severity: 'medium',
      message: `${plural(schools.pending, 'school')} still being onboarded.`,
      to: '/schools',
    });
  }
  return items;
}

/** "3 of 5" coverage text and whether it is complete. */
export function coverage(done: number, total: number): { text: string; complete: boolean } {
  return { text: total === 0 ? '—' : `${done} of ${total}`, complete: total > 0 && done === total };
}
