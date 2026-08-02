import { useTheme } from '@/hooks/useTheme';
import { MoonIcon, SunIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full',
        'border border-border-strong bg-surface-raised text-content-secondary',
        'transition-colors duration-150 hover:text-content-primary',
        className,
      )}
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
