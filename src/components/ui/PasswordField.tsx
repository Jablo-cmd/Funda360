import { forwardRef, useState } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { TextFieldProps } from '@/components/ui/TextField';
import { EyeIcon, EyeOffIcon } from '@/components/ui/icons';

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'rightElement'>;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (props, ref) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <TextField
        ref={ref}
        type={isVisible ? 'text' : 'password'}
        rightElement={
          <button
            type="button"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-pressed={isVisible}
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            className="focus-ring rounded-md p-1.5 text-content-tertiary hover:text-content-secondary"
          >
            {isVisible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        }
        {...props}
      />
    );
  },
);

PasswordField.displayName = 'PasswordField';
