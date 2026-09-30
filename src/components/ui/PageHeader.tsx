import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Pass a fully-wrapped action (its own width/sizing div included) — PageHeader stays unopinionated about button width. */
  action?: ReactNode;
}

/**
 * The title + description + primary-action row every list/overview page
 * already rendered independently. Not used by detail/profile pages, which
 * have their own bespoke identity headers (learner, employee, user).
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    // Stacks until `lg`: from `md` the sidebar leaves the page area only ~512px, too narrow for a title and an action side by side.
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold text-content-primary">{title}</h1>
        {description && (
          <p className="mt-1 break-words text-sm text-content-secondary">{description}</p>
        )}
      </div>
      {action && <div className="w-full min-w-0 lg:w-auto lg:shrink-0">{action}</div>}
    </div>
  );
}
