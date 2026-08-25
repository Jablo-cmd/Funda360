import type { LearnerAlert } from '@/features/learners/utils/learnerAlerts';

export interface AlertsBannerProps {
  alerts: LearnerAlert[];
}

export function AlertsBanner({ alerts }: AlertsBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-card border border-warning-500/30 bg-warning-50 p-4 dark:bg-warning-500/10"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-warning-700 dark:text-warning-500">
        Attention Required
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex items-center gap-2 text-sm text-warning-700 dark:text-warning-400">
            <span aria-hidden="true">⚠</span>
            {alert.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
