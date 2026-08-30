import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Internal only (not exported) — lets DropdownItem close the menu after
// its own onClick fires, without the outer role="menu" container needing
// a click handler of its own (a plain onClick on an ARIA menu container
// fails jsx-a11y's interactive-supports-focus/click-events-have-key-events
// checks for good reason: WAI-ARIA menu semantics expect each menuitem to
// handle its own activation, not the container).
const DropdownCloseContext = createContext<(() => void) | null>(null);

export interface DropdownProps {
  /** Render-prop so the trigger can reflect isOpen (e.g. rotate a chevron, set aria-expanded) without the caller managing its own open state. */
  trigger: (state: { isOpen: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  /** Only needed if the trigger's own accessible name doesn't already describe the menu's purpose. */
  menuLabel?: string;
}

export interface DropdownItemProps {
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  variant?: 'default' | 'danger';
}

/**
 * A generic action-menu primitive (FND-UX-004) — extracted from the exact
 * click-outside/Escape/aria-menu pattern UserMenu.tsx had hand-rolled on
 * its own (now its first real consumer, not a parallel implementation).
 * Not a replacement for a plain `<select>` — every existing form field in
 * this app already uses native `<select>` successfully and those stay
 * exactly as they are; this is for an action menu (a set of clickable
 * commands), the shape UserMenu's own dropdown already was.
 */
export function Dropdown({ trigger, children, align = 'right', menuLabel }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = () => setIsOpen((open) => !open);
  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ isOpen, toggle })}

      {isOpen && (
        <div
          role="menu"
          aria-label={menuLabel}
          className={cn(
            'absolute z-20 mt-2 w-56 rounded-card border border-border bg-surface-raised p-1.5 shadow-card dark:shadow-card-dark',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <DropdownCloseContext.Provider value={close}>{children}</DropdownCloseContext.Provider>
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ onClick, children, icon, variant = 'default' }: DropdownItemProps) {
  const closeMenu = useContext(DropdownCloseContext);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onClick?.();
        closeMenu?.();
      }}
      className={cn(
        'focus-ring flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
        variant === 'danger'
          ? 'text-danger-600 hover:bg-danger-50'
          : 'text-content-secondary hover:bg-surface-sunken hover:text-content-primary',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
