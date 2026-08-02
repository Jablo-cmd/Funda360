import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';

/**
 * Temporary landing target for authenticated users. The real application
 * shell and dashboard land in later epics — this only exists so the
 * protected-route flow has somewhere to send a signed-in user, and to
 * surface that the tenant/profile/RBAC foundation is actually wired up.
 */
export function HomePlaceholderPage() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { tenant, status: tenantStatus } = useTenant();

  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : null;
  const roleLabel = profile?.role ? profile.role.replace(/_/g, ' ') : 'No role assigned';

  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <header className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <div className="w-full max-w-sm rounded-card border border-border bg-surface-raised p-6 text-left shadow-card dark:shadow-card-dark">
          <h1 className="text-xl font-bold text-content-primary">You&apos;re signed in</h1>
          <p className="mt-1 text-sm text-content-tertiary">
            The application shell and dashboard aren&apos;t built yet — this is a placeholder
            confirming the multi-tenant foundation is wired up end to end.
          </p>

          <dl className="mt-5 flex flex-col gap-3 border-t border-border pt-4 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-content-secondary">Current user</dt>
              <dd className="font-medium text-content-primary">{fullName ?? profile?.email ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-content-secondary">Current role</dt>
              <dd className="font-medium capitalize text-content-primary">{roleLabel}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-content-secondary">Current school</dt>
              <dd className="font-medium text-content-primary">{tenant?.school.name ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-content-secondary">Tenant status</dt>
              <dd className="font-medium capitalize text-content-primary">{tenantStatus}</dd>
            </div>
          </dl>
        </div>

        <div className="w-full max-w-xs">
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </main>
    </div>
  );
}
