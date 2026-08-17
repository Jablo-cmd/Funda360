import { cn } from '@/lib/cn';

export interface LoadingBlockProps {
  label: string;
  /** Section-level spinner (h-6 w-6, py-10) instead of the page-level default (h-8 w-8, py-16). */
  compact?: boolean;
  className?: string;
}

/**
 * The localized inline spinner used wherever a hook is loading but the rest
 * of the page chrome (header, filters) should stay visible — as opposed to
 * FullScreenSpinner, which replaces the entire page. Every page previously
 * hand-copied this markup with only the sr-only label text changed.
 */
export function LoadingBlock({ label, compact = false, className }: LoadingBlockProps) {
  return (
    <div className={cn('flex justify-center', compact ? 'py-10' : 'py-16', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent',
          compact ? 'h-6 w-6' : 'h-8 w-8',
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
