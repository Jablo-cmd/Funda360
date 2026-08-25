import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/PasswordField';
import { useAuth } from '@/features/auth/context/authContext';
import { activationService } from '@/features/auth/services/activationService';
import type { GuardianInvitationContext } from '@/features/auth/services/activationService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { resetPasswordSchema, resetPasswordDefaultValues, type ResetPasswordFormValues } from '@/features/auth/schemas/resetPasswordSchema';

const BLOCKED_STATUS_COPY: Record<'accepted' | 'revoked' | 'expired', string> = {
  accepted: 'This account has already been activated. Please sign in with your existing password.',
  revoked: 'This invitation has been revoked by your school. Please contact them for a new one.',
  expired: 'This invitation has expired. Please contact your school to request a new one.',
};

function ChildrenList({ children }: { children: GuardianInvitationContext['children'] }) {
  if (children.length === 0) return null;
  return (
    <div className="mb-5 rounded-lg border border-border bg-surface-sunken px-3.5 py-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-tertiary">This account covers</p>
      <ul className="flex flex-col gap-0.5 text-sm text-content-primary">
        {children.map((child) => (
          <li key={child.id}>
            {child.firstName} {child.lastName}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActivateAccountForm() {
  const { updatePassword, signOut } = useAuth();
  const [context, setContext] = useState<GuardianInvitationContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    activationService
      .getMyInvitationContext()
      .then((result) => {
        if (isMounted) setContext(result);
      })
      .catch((error: unknown) => {
        if (isMounted) setLoadError(getDbErrorMessage(error, 'This invitation link is invalid.'));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

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
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to set your password.'));
      return;
    }

    try {
      await activationService.acceptInvitation();
    } catch (error) {
      // The password is already set at this point — that's the property
      // that actually matters for account security. A failure here only
      // means the invitation audit row didn't flip to "accepted" (e.g. an
      // admin revoked it in the few seconds between page load and submit);
      // the guardian can still sign in normally, so we don't block them.
      console.error('accept_guardian_invitation failed after password was set', error);
    }

    await signOut({ redirectState: { justActivated: true } });
  };

  // A blocked/invalid invitation still leaves the browser holding the
  // temporary Supabase recovery session (we can't invalidate the
  // underlying Supabase-issued token, only our own guardian_invitations
  // audit row — see the migration's comments). Signing out here, rather
  // than a plain <Link to="/login">, is what makes that link actually land
  // on the login form instead of PublicOnlyRoute immediately bouncing an
  // still-"authenticated" session back into the app.
  const goToSignIn = () => void signOut();

  if (isLoading) {
    return <p className="text-sm text-content-secondary">Checking your invitation…</p>;
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {loadError}
        </div>
        <button
          type="button"
          onClick={goToSignIn}
          className="focus-ring self-start rounded text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  if (!context || !context.invitationEffectiveStatus || context.invitationEffectiveStatus !== 'pending') {
    const status = context?.invitationEffectiveStatus;
    const message =
      status && status in BLOCKED_STATUS_COPY
        ? BLOCKED_STATUS_COPY[status as 'accepted' | 'revoked' | 'expired']
        : 'This invitation link is invalid or is no longer active.';
    return (
      <div className="flex flex-col gap-5">
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {message}
        </div>
        <button
          type="button"
          onClick={goToSignIn}
          className="focus-ring self-start rounded text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5">
      <p className="text-sm text-content-secondary">
        Welcome, {context.guardianFirstName}. {context.schoolName} has invited you to access your Parent Portal account.
      </p>

      <ChildrenList children={context.children} />

      {submitError && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {submitError}
        </div>
      )}

      <PasswordField
        id="new-password"
        label="Choose a password"
        autoComplete="new-password"
        placeholder="Enter a password"
        hint="Must be at least 8 characters."
        required
        error={errors.password?.message}
        {...register('password')}
      />

      <PasswordField
        id="confirm-new-password"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Activating…' : 'Activate my account'}
      </Button>
    </form>
  );
}
