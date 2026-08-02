import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { CloseIcon } from '@/components/ui/icons';

export function DashboardLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <DashboardHeader onMenuClick={() => setIsMobileNavOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface-raised md:block">
          <DashboardSidebar />
        </aside>

        {isMobileNavOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col border-r border-border bg-surface-raised shadow-card dark:shadow-card-dark">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold text-content-primary">Menu</span>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  aria-label="Close menu"
                  className="focus-ring rounded-md p-1.5 text-content-secondary hover:text-content-primary"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              <DashboardSidebar onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
