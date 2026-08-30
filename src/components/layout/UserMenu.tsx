import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { ChevronDownIcon, LogOutIcon } from '@/components/ui/icons';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn } from '@/lib/cn';

export function UserMenu() {
  const { signOut } = useAuth();
  const { profile } = useProfile();

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
    <Dropdown
      menuLabel="Account menu"
      trigger={({ isOpen, toggle }) => (
        <button
          type="button"
          onClick={toggle}
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
          <ChevronDownIcon className={cn('h-4 w-4 text-content-tertiary transition-transform', isOpen && 'rotate-180')} />
        </button>
      )}
    >
      <div className="px-2.5 py-2 text-sm">
        <p className="truncate font-medium text-content-primary">{fullName ?? 'Account'}</p>
        <p className="truncate text-content-tertiary">{profile?.email}</p>
        {profile?.role && <p className="mt-0.5 capitalize text-content-tertiary">{profile.role.replace(/_/g, ' ')}</p>}
      </div>
      <div className="my-1 h-px bg-border" />
      <DropdownItem onClick={() => void signOut()} icon={<LogOutIcon className="h-4 w-4" />}>
        Sign out
      </DropdownItem>
    </Dropdown>
  );
}
