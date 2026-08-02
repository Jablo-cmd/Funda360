import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { ChevronDownIcon, LogOutIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export function UserMenu() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : null;
  const initials = fullName
    ? fullName
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="focus-ring flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-surface-sunken"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-content-primary sm:block">
          {fullName ?? profile?.email ?? 'Account'}
        </span>
        <ChevronDownIcon
          className={cn('h-4 w-4 text-content-tertiary transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-card border border-border bg-surface-raised p-1.5 shadow-card dark:shadow-card-dark"
        >
          <div className="px-2.5 py-2 text-sm">
            <p className="truncate font-medium text-content-primary">{fullName ?? 'Account'}</p>
            <p className="truncate text-content-tertiary">{profile?.email}</p>
            {profile?.role && (
              <p className="mt-0.5 capitalize text-content-tertiary">{profile.role.replace(/_/g, ' ')}</p>
            )}
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="focus-ring flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
          >
            <LogOutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
