import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  leftIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/60',
  secondary:
    'bg-surface-raised text-content-primary border border-border-strong hover:bg-surface-sunken disabled:opacity-60',
  ghost: 'bg-transparent text-content-secondary hover:bg-surface-raised disabled:opacity-60',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', isLoading = false, leftIcon, disabled, className, children, ...props },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={cn(
          'focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4',
          'text-sm font-semibold transition-colors duration-150',
          'disabled:cursor-not-allowed',
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin-smooth rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
      </button>
    );
  },
);

Button.displayName = 'Button';
