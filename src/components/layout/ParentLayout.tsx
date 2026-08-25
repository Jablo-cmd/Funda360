import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ParentHeader } from '@/components/layout/ParentHeader';
import { ParentNav } from '@/components/layout/ParentNav';
import { AppFooter } from '@/components/layout/AppFooter';
import { CloseIcon } from '@/components/ui/icons';

/** Mirrors DashboardLayout's shell shape (header + collapsible mobile nav + main + footer) with a purpose-built, simpler nav — see ParentNav. */
export function ParentLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-sunken">
      <ParentHeader onMenuClick={() => setIsMobileNavOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 md:block">
          <ParentNav />
        </aside>

        {isMobileNavOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col border-r border-sidebar-border bg-sidebar shadow-card dark:shadow-card-dark">
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
              <ParentNav onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <AppFooter />
    </div>
  );
}
