import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MenuIcon, SearchIcon } from '@/components/ui/icons';
import { UserMenu } from '@/components/layout/UserMenu';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { usePermissions } from '@/hooks/usePermissions';
import { getPageTitle } from '@/lib/pageTitles';

export interface DashboardHeaderProps {
  onMenuClick: () => void;
  /** Omitted (rather than gated internally) when the caller holds none of learner.view/employee.view/guardian.view — DashboardLayout already knows this before rendering the button, so there is nothing to show. */
  onSearchClick?: () => void;
}

/**
 * The title/section text below is a breadcrumb-style label, not a heading —
 * every page already renders its own canonical <h1>, and a second <h1> here
 * would both break single-H1-per-page accessibility and make every
 * `getByRole('heading', ...)` query in the app ambiguous.
 */
export function DashboardHeader({ onMenuClick, onSearchClick }: DashboardHeaderProps) {
  const { school } = useSchool();
  const { currentAcademicYear } = useAcademic();
  const { can } = usePermissions();
  const { pathname } = useLocation();
  const { title, section } = getPageTitle(pathname);
  const canSwitchSchool = can('tenant.switch');

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-1 border-b border-border bg-surface-raised px-2 sm:h-[4.5rem] sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="focus-ring touch-target flex shrink-0 items-center justify-center rounded-md text-content-secondary hover:text-content-primary md:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <div className="hidden md:block">
          <Logo />
        </div>

        <div className="hidden h-9 w-px bg-border md:block" />

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-base font-semibold leading-tight text-content-primary sm:truncate sm:text-lg">
            {title}
          </p>
          <p className="hidden truncate font-mono text-xs uppercase tracking-wide text-content-tertiary sm:block">
            {section}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2 lg:gap-3">
        <span className="hidden max-w-[16rem] truncate text-right lg:block">
          <span className="block text-sm font-medium text-content-secondary">
            {school?.name ?? 'No school selected'}
          </span>
          {currentAcademicYear && (
            <span className="block font-mono text-[11px] uppercase tracking-wide text-content-tertiary">
              {currentAcademicYear.name}
            </span>
          )}
        </span>
        {canSwitchSchool && (
          <Link
            to="/schools"
            className="focus-ring hidden h-9 shrink-0 items-center rounded-md border border-border-strong px-3 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-sunken hover:text-content-primary lg:flex"
          >
            Switch school
          </Link>
        )}
        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Search"
            className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-md text-content-secondary transition-colors hover:bg-surface-sunken hover:text-content-primary lg:h-9 lg:w-auto lg:border lg:border-border-strong lg:px-3 lg:text-xs lg:font-medium"
          >
            <SearchIcon className="h-5 w-5 lg:h-3.5 lg:w-3.5" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden rounded border border-border-strong px-1 py-0.5 text-[10px] text-content-tertiary lg:inline">
              ⌘K
            </kbd>
          </button>
        )}
        <div className="hidden h-9 w-px bg-border lg:block" />
        <NotificationBell to="/notifications" />
        <ThemeToggle className="hidden sm:inline-flex" />
        <UserMenu />
      </div>
    </header>
  );
}
