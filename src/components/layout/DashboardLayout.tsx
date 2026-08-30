import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { AppFooter } from '@/components/layout/AppFooter';
import { CloseIcon } from '@/components/ui/icons';
import { MfaRequiredBanner } from '@/features/mfa/components/MfaRequiredBanner';
import { CommandPalette } from '@/features/search/components/CommandPalette';
import { usePermissions } from '@/hooks/usePermissions';

export function DashboardLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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

        {isMobileNavOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col border-r border-sidebar-border bg-sidebar shadow-card dark:shadow-card-dark">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
                <span className="text-sm font-semibold uppercase tracking-wide text-white/90">Menu</span>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  aria-label="Close menu"
                  className="focus-ring rounded-md p-1.5 text-white/70 hover:text-white"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              <DashboardSidebar onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <MfaRequiredBanner />
          <Outlet />
        </main>
      </div>

      <AppFooter />

      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
