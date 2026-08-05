import { NavLink } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/context/authContext';
import { hasPermission } from '@/features/rbac';
import {
  BriefcaseIcon,
  BuildingIcon,
  ChalkboardIcon,
  ChartIcon,
  GearIcon,
  GraduationCapIcon,
  GridIcon,
  LayersIcon,
  UsersIcon,
} from '@/components/ui/icons';

interface NavItem {
  label: string;
  path?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const { user } = useAuth();
  const canViewUsers = hasPermission(user?.role ?? null, 'profile.view_any');
  const canViewEmployees = hasPermission(user?.role ?? null, 'employee.view');
  const canViewAcademic = hasPermission(user?.role ?? null, 'academic.view');
  const canViewLearners = hasPermission(user?.role ?? null, 'learner.view');
  const canViewReports = hasPermission(user?.role ?? null, 'reports.view');

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: GridIcon },
    { label: 'My Profile', path: '/my-profile', icon: UsersIcon },
    { label: 'School Profile', path: '/school/profile', icon: BuildingIcon },
    ...(canViewUsers ? [{ label: 'Users', path: '/users', icon: UsersIcon }] : []),
    ...(canViewEmployees ? [{ label: 'Employees', path: '/employees', icon: BriefcaseIcon }] : []),
    ...(canViewAcademic ? [{ label: 'Academic', path: '/academic', icon: LayersIcon }] : []),
    ...(canViewLearners
      ? [{ label: 'Students', path: '/learners', icon: GraduationCapIcon }]
      : [{ label: 'Students', icon: GraduationCapIcon }]),
    { label: 'Teachers', icon: ChalkboardIcon },
    ...(canViewReports ? [{ label: 'Reports', path: '/reports', icon: ChartIcon }] : [{ label: 'Reports', icon: ChartIcon }]),
    { label: 'Settings', icon: GearIcon },
  ];

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      {navItems.map(({ label, path, icon: Icon }) =>
        path ? (
          <NavLink
            key={label}
            to={path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'text-content-secondary hover:bg-surface-sunken hover:text-content-primary',
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ) : (
          <div
            key={label}
            className="flex cursor-not-allowed items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-content-tertiary"
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
              Soon
            </span>
          </div>
        ),
      )}
    </nav>
  );
}
