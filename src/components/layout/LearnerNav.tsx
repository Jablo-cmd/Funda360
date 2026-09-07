import { NavLink } from 'react-router-dom';
import {
  BookIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  ClipboardListIcon,
  GridIcon,
  MegaphoneIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export interface LearnerNavProps {
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { label: 'Home', path: '/learner/dashboard', icon: GridIcon },
  { label: 'Timetable', path: '/learner/timetable', icon: CalendarIcon },
  { label: 'Homework', path: '/learner/homework', icon: BookIcon },
  { label: 'Results', path: '/learner/results', icon: ChartIcon },
  { label: 'Report cards', path: '/learner/report-cards', icon: ClipboardListIcon },
  { label: 'Attendance', path: '/learner/attendance', icon: CheckIcon },
  { label: 'Documents', path: '/learner/documents', icon: BookIcon },
  { label: 'Announcements', path: '/learner/announcements', icon: MegaphoneIcon },
  { label: 'My Profile', path: '/learner/profile', icon: UsersIcon },
];

/**
 * The learner's own navigation — deliberately as spare as ParentNav, and
 * for the same reason: this is a purpose-built self-service surface, never
 * the school admin backend. No admin actions anywhere.
 */
export function LearnerNav({ onNavigate }: LearnerNavProps) {
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
