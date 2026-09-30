import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { AppFooter } from '@/components/layout/AppFooter';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';
import { MfaRequiredBanner } from '@/features/mfa/components/MfaRequiredBanner';
import { CommandPalette } from '@/features/search/components/CommandPalette';
import { usePermissions } from '@/hooks/usePermissions';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { can } = usePermissions();
  const canSearchAnything = can('learner.view') || can('employee.view') || can('guardian.view');

  // The global Cmd/Ctrl+K shortcut lives here (the one place that's always
  // mounted regardless of which page is active), alongside the header's
  // visible search button — both open the same controlled CommandPalette.
  useEffect(() => {
    if (!canSearchAnything) return;
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [canSearchAnything]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-sunken">
      <DashboardHeader
        onMenuClick={() => setIsMobileNavOpen(true)}
        onSearchClick={canSearchAnything ? () => setIsSearchOpen(true) : undefined}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 md:block">
          <DashboardSidebar />
        </aside>

        <MobileNavDrawer isOpen={isMobileNavOpen} onClose={closeMobileNav} widthClassName="w-72">
          <DashboardSidebar onNavigate={closeMobileNav} />
        </MobileNavDrawer>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <MfaRequiredBanner />
          <ErrorBoundary context="staff-route" resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
          <AppFooter className="mt-auto md:hidden" />
        </main>
      </div>

      <AppFooter className="max-md:hidden" />

      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
