import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ParentHeader } from '@/components/layout/ParentHeader';
import { LearnerNav } from '@/components/layout/LearnerNav';
import { AppFooter } from '@/components/layout/AppFooter';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';

/** Mirrors ParentLayout's shell with the learner's own navigation. */
export function LearnerLayout() {
  const { pathname } = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-sunken">
      <ParentHeader onMenuClick={() => setIsMobileNavOpen(true)} notificationsPath="/learner/notifications" />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 md:block">
          <LearnerNav />
        </aside>

        <MobileNavDrawer isOpen={isMobileNavOpen} onClose={closeMobileNav} widthClassName="w-64">
          <LearnerNav onNavigate={closeMobileNav} />
        </MobileNavDrawer>

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <ErrorBoundary context="learner-route" resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
          <AppFooter className="mt-auto md:hidden" />
        </main>
      </div>

      <AppFooter className="max-md:hidden" />
    </div>
  );
}
