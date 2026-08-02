import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="focus-ring h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong text-brand-600 accent-brand-600"
          {...props}
        />
        <label htmlFor={inputId} className="cursor-pointer select-none text-sm text-content-secondary">
          {label}
        </label>
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
