import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageContainerProps {
  children: ReactNode;
  /** lg (max-w-5xl) = list/overview pages, the default. md/sm = profile/detail pages. */
  width?: 'lg' | 'md' | 'sm';
  className?: string;
}

const WIDTH_CLASSES: Record<NonNullable<PageContainerProps['width']>, string> = {
  lg: 'max-w-5xl',
  md: 'max-w-3xl',
  sm: 'max-w-2xl',
};

/**
 * Standardizes the workspace width/padding/vertical-rhythm shell that every
 * dashboard page already used independently (mx-auto max-w-* px-4 py-8
 * sm:px-6, flex flex-col gap-6) — extracted so it's declared once instead of
 * copy-pasted per page.
 */
export function PageContainer({ children, width = 'lg', className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto flex flex-col gap-6 px-4 py-8 sm:px-6', WIDTH_CLASSES[width], className)}>
      {children}
    </div>
  );
}
