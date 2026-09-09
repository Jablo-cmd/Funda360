import { Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { resolveNavForRole } from '@/features/rbac/constants/navigation';

export interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const { user } = useAuth();
  const { profile } = useProfile();

  // The sidebar is composed from the role's actual usable capabilities —
  // every item here links somewhere the signed-in user can genuinely go.
  // There is no "show but disable" branch: an item a role cannot use is
  // simply absent (see resolveNavForRole).
  const sections = resolveNavForRole(user?.role ?? null);

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
    <div className="flex h-full flex-col bg-sidebar text-white">
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ label, path, icon: Icon, end }) => (
                <NavLink
                  key={label}
                  to={path}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-white/70 hover:bg-sidebar-raised hover:text-white',
                    )
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <Link
          to="/my-profile"
          onClick={onNavigate}
          className="focus-ring flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-sidebar-raised"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-active text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">
              {fullName ?? 'Account'}
            </span>
            <span className="block truncate text-xs capitalize text-white/50">
              {profile?.role ? profile.role.replace(/_/g, ' ') : '—'}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
