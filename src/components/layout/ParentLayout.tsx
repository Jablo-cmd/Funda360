import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ParentHeader } from '@/components/layout/ParentHeader';
import { ParentNav } from '@/components/layout/ParentNav';
import { AppFooter } from '@/components/layout/AppFooter';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';
import { ConsentOnboardingGate } from '@/features/compliance/components/ConsentOnboardingGate';

/** Mirrors DashboardLayout's shell shape (header + collapsible mobile nav + main + footer) with a purpose-built, simpler nav — see ParentNav. */
export function ParentLayout() {
  const { pathname } = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-sunken">
      <ParentHeader onMenuClick={() => setIsMobileNavOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 md:block">
          <ParentNav />
        </aside>

        <MobileNavDrawer isOpen={isMobileNavOpen} onClose={closeMobileNav} widthClassName="w-64">
          <ParentNav onNavigate={closeMobileNav} />
        </MobileNavDrawer>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <ConsentOnboardingGate>
            <ErrorBoundary context="parent-route" resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          </ConsentOnboardingGate>
          <AppFooter className="mt-auto md:hidden" />
        </main>
      </div>

      <AppFooter className="max-md:hidden" />
    </div>
  );
}
