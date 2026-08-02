import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/PasswordField';
import { useAuth } from '@/features/auth/context/authContext';
import { getAuthErrorMessage } from '@/features/auth/utils/authErrors';
import {
  resetPasswordSchema,
  resetPasswordDefaultValues,
  type ResetPasswordFormValues,
} from '@/features/auth/schemas/resetPasswordSchema';

export function ResetPasswordForm() {
  const { updatePassword, signOut } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: resetPasswordDefaultValues,
    mode: 'onBlur',
  });

  const onValid = async (values: ResetPasswordFormValues) => {
    setSubmitError(null);
    try {
      await updatePassword(values.password);
      // The recovery session is still live post-update; end it so the user
      // confirms their new password by signing in fresh (RBAC spec §13 —
      // secure session management / no lingering elevated sessions).
      await signOut({ redirectState: { justReset: true } });
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5">
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {submitError}
        </div>
      )}

      <PasswordField
        id="new-password"
        label="New password"
        autoComplete="new-password"
        placeholder="Enter a new password"
        hint="Must be at least 8 characters."
        required
        error={errors.password?.message}
        {...register('password')}
      />

      <PasswordField
        id="confirm-new-password"
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="Re-enter your new password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
