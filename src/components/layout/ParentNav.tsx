import { NavLink } from 'react-router-dom';
import { GridIcon, GraduationCapIcon, UsersIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export interface ParentNavProps {
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { label: 'Home', path: '/parent/dashboard', icon: GridIcon },
  { label: 'My Children', path: '/parent/children', icon: GraduationCapIcon },
  { label: 'My Profile', path: '/parent/profile', icon: UsersIcon },
];

/**
 * Deliberately three items only — the Parent Portal is not the staff
 * sidebar with sections hidden by permission, it is a purpose-built,
 * substantially simpler navigation (Phase 6).
 */
export function ParentNav({ onNavigate }: ParentNavProps) {
  return (
    <nav className="flex h-full flex-col gap-1 bg-sidebar px-3 py-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
