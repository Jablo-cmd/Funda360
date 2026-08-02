import { cn } from '@/lib/cn';

export interface LogoProps {
  variant?: 'default' | 'inverse';
  showWordmark?: boolean;
  className?: string;
}

/**
 * Funda360 mark: three overlapping tiles representing the platform's
 * multi-tenant, 360° view of a school's operations.
 */
export function Logo({ variant = 'default', showWordmark = true, className }: LogoProps) {
  const wordmarkClass = variant === 'inverse' ? 'text-white' : 'text-content-primary';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="9" className="fill-brand-600" />
        <path
          d="M9 21.5V11.8c0-.66.54-1.2 1.2-1.2h8.6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M9.6 16.2h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {showWordmark && (
        <span className={cn('text-lg font-bold tracking-tight', wordmarkClass)}>
          Funda<span className="text-brand-500">360</span>
        </span>
      )}
    </div>
  );
}
