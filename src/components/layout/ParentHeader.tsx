import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MenuIcon } from '@/components/ui/icons';
import { UserMenu } from '@/components/layout/UserMenu';
import { useSchool } from '@/features/school/hooks/useSchool';

export interface ParentHeaderProps {
  onMenuClick: () => void;
}

/**
 * Deliberately simpler than DashboardHeader — no breadcrumb title/section,
 * no tenant switcher, no academic-year label. A parent should never feel
 * like they're looking at the school's admin backend.
 */
export function ParentHeader({ onMenuClick }: ParentHeaderProps) {
  const { school } = useSchool();

  return (
    <header className="flex h-[4.5rem] shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-raised px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="focus-ring -ml-1 shrink-0 rounded-md p-1.5 text-content-secondary hover:text-content-primary md:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <Logo />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {school && (
          <span className="hidden max-w-[16rem] truncate text-sm font-medium text-content-secondary sm:block">
            {school.name}
          </span>
        )}
        <div className="hidden h-9 w-px bg-border sm:block" />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
