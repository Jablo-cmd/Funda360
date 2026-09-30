import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CloseIcon } from '@/components/ui/icons';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tailwind width class for the panel, e.g. `w-72`. Always capped at 85% of the viewport. */
  widthClassName?: string;
  children: ReactNode;
}

/**
 * The slide-in navigation used by every shell below the `md` breakpoint.
 * It is a modal dialog: Escape and the backdrop close it, Tab stays inside it,
 * focus returns to the menu button afterwards, and it closes by itself when
 * the route changes (so the browser back button never leaves it stuck open).
 */
export function MobileNavDrawer({
  isOpen,
  onClose,
  widthClassName = 'w-72',
  children,
}: MobileNavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const { pathname } = useLocation();
  const openedAtPath = useRef(pathname);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    openedAtPath.current = pathname;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
    // `pathname` is read once on open; route changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && pathname !== openedAtPath.current) onCloseRef.current();
  }, [pathname, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-y-0 left-0 flex max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar shadow-card dark:shadow-card-dark ${widthClassName}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <span
            id={titleId}
            className="text-sm font-semibold uppercase tracking-wide text-white/90"
          >
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="focus-ring touch-target flex items-center justify-center rounded-md p-1.5 text-white/70 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
