import type { ReactNode } from 'react';

export interface CardProps {
  title: string;
  /** Rendered top-right of the header, e.g. a status pill or a "View all" link. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * The section/summary card wrapper Learner 360 is built from — every
 * DashboardPage panel already used this exact markup independently
 * (rounded-card border bg-surface-raised p-4 + uppercase label heading);
 * extracted here since Learner 360 needs the same shape ~8 times on one
 * page instead of once.
 */
export function Card({ title, action, children }: CardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
