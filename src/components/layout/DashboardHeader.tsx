import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MenuIcon } from '@/components/ui/icons';
import { UserMenu } from '@/components/layout/UserMenu';
import { useSchool } from '@/features/school/hooks/useSchool';

export interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { school } = useSchool();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface-raised px-4 sm:px-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="focus-ring -ml-1 rounded-md p-1.5 text-content-secondary hover:text-content-primary md:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <Logo />
        <div className="hidden h-6 w-px bg-border sm:block" />
        <span className="hidden max-w-[16rem] truncate text-sm font-medium text-content-secondary sm:block">
          {school?.name ?? 'No school selected'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
