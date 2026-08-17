import { Link, NavLink } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { hasPermission } from '@/features/rbac';
import {
  BookIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChalkboardIcon,
  CheckIcon,
  ChartIcon,
  GraduationCapIcon,
  GridIcon,
  LayersIcon,
  UsersIcon,
} from '@/components/ui/icons';

interface NavItem {
  label: string;
  path?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Exact-match only — for an item whose path is itself a prefix of sibling items' paths (e.g. /academic vs /academic/years), so it doesn't show active on every sub-page. */
  end?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const role = user?.role ?? null;

  const canViewUsers = hasPermission(role, 'profile.view_any');
  const canViewEmployees = hasPermission(role, 'employee.view');
  const canViewAcademic = hasPermission(role, 'academic.view');
  const canViewLearners = hasPermission(role, 'learner.view');
  const canViewReports = hasPermission(role, 'reports.view');
  const canViewAttendance = hasPermission(role, 'attendance.view');
  const canViewAssessments = hasPermission(role, 'assessment.view');

  const sections: NavSection[] = [
    {
      label: 'Overview',
      items: [{ label: 'Dashboard', path: '/dashboard', icon: GridIcon }],
    },
    {
      label: 'People',
      items: [
        canViewLearners
          ? { label: 'Learners', path: '/learners', icon: GraduationCapIcon }
          : { label: 'Learners', icon: GraduationCapIcon },
        { label: 'Guardians', icon: UsersIcon },
        canViewEmployees
          ? { label: 'Employees', path: '/employees', icon: BriefcaseIcon }
          : { label: 'Employees', icon: BriefcaseIcon },
      ],
    },
    {
      label: 'Academics',
      items: [
        canViewAcademic
          ? { label: 'Academic Overview', path: '/academic', icon: LayersIcon, end: true }
          : { label: 'Academic Overview', icon: LayersIcon },
        canViewAcademic
          ? { label: 'Academic Years', path: '/academic/years', icon: CalendarIcon }
          : { label: 'Academic Years', icon: CalendarIcon },
        canViewAcademic
          ? { label: 'Terms', path: '/academic/terms', icon: BookIcon }
          : { label: 'Terms', icon: BookIcon },
        canViewAcademic
          ? { label: 'Grades', path: '/academic/grades', icon: LayersIcon }
          : { label: 'Grades', icon: LayersIcon },
        canViewAcademic
          ? { label: 'Classes', path: '/academic/classes', icon: ChalkboardIcon }
          : { label: 'Classes', icon: ChalkboardIcon },
        canViewAcademic
          ? { label: 'Subjects', path: '/academic/subjects', icon: BookIcon }
          : { label: 'Subjects', icon: BookIcon },
        canViewAcademic
          ? { label: 'Teaching Assignments', path: '/academic/teaching-assignments', icon: UsersIcon }
          : { label: 'Teaching Assignments', icon: UsersIcon },
        canViewAssessments
          ? { label: 'Assessments', path: '/academic/assessments', icon: ChartIcon }
          : { label: 'Assessments', icon: ChartIcon },
      ],
    },
    {
      label: 'Operations',
      items: [
        canViewAttendance
          ? { label: 'Attendance', path: '/attendance', icon: CheckIcon }
          : { label: 'Attendance', icon: CheckIcon },
        { label: 'My Classes', path: '/my-profile', icon: ChalkboardIcon },
      ],
    },
    {
      label: 'Reporting',
      items: [
        canViewReports
          ? { label: 'Reports', path: '/reports', icon: ChartIcon }
          : { label: 'Reports', icon: ChartIcon },
      ],
    },
    {
      label: 'Administration',
      items: [
        canViewUsers
          ? { label: 'Users & Roles', path: '/users', icon: UsersIcon }
          : { label: 'Users & Roles', icon: UsersIcon },
        { label: 'School Profile', path: '/school/profile', icon: BuildingIcon },
        { label: 'My Profile', path: '/my-profile', icon: UsersIcon },
      ],
    },
  ];

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
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ label, path, icon: Icon, end }) =>
                path ? (
                  <NavLink
                    key={label}
                    to={path}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-sidebar-active text-white' : 'text-white/70 hover:bg-sidebar-raised hover:text-white',
                      )
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {label}
                  </NavLink>
                ) : (
                  <div
                    key={label}
                    className="flex cursor-not-allowed items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/35"
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {label}
                    </span>
                    <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                      Soon
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white/60">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
          <span className="font-mono uppercase tracking-wider">System Operational</span>
        </div>

        <Link
          to="/my-profile"
          onClick={onNavigate}
          className="focus-ring mt-1.5 flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-sidebar-raised"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-active text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{fullName ?? 'Account'}</span>
            <span className="block truncate text-xs capitalize text-white/50">
              {profile?.role ? profile.role.replace(/_/g, ' ') : '—'}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
