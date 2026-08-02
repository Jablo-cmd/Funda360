import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  error?: string;
  hint?: string;
  rightElement?: ReactNode;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { label, error, hint, rightElement, containerClassName, id, required, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-content-primary"
          >
            {label}
            {required && (
              <span className="text-danger-600" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={cn(hintId, errorId) || undefined}
            className={cn(
              'focus-ring h-11 w-full rounded-lg border bg-surface-raised px-3.5 text-sm text-content-primary',
              'placeholder:text-content-tertiary',
              'transition-colors duration-150',
              rightElement && 'pr-11',
              error
                ? 'border-danger-500 focus-visible:ring-danger-500'
                : 'border-border-strong',
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              {rightElement}
            </div>
          )}
        </div>

        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-xs text-content-tertiary">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
            {error}
          </p>
        )}
      </div>
    );
  },
);

TextField.displayName = 'TextField';
