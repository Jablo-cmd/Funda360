import type { ComponentType, SVGProps } from 'react';
import type { UserRole } from '@/features/auth/types/auth.types';
import type { Permission } from '@/features/rbac/types/permission.types';
import { hasAnyPermission } from '@/features/rbac/utils/permissionHelpers';
import {
  BookIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChalkboardIcon,
  ChatIcon,
  CheckIcon,
  ChartIcon,
  ClipboardListIcon,
  GearIcon,
  GraduationCapIcon,
  GridIcon,
  LayersIcon,
  MegaphoneIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
} from '@/components/ui/icons';

export interface NavItemDef {
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * The item renders only if the signed-in role holds at least one of these
   * permissions. Omit for items every authenticated staff member should see
   * (Dashboard, Messages, My Profile). There is no "show but disable" path —
   * an item the role cannot use is simply not in the model for that role.
   *
   * Note several items deliberately gate on a `.manage` / `.export` /
   * `manage_any` permission rather than the matching `.view`: a plain
   * teacher holds `academic.view` but must not see the academic-structure
   * admin pages, so those gate on `academic.manage`; the Reports section
   * gates on `reports.export` so a teacher (who only holds `reports.view`
   * for RLS scoping) does not get a Reports nav entry, etc.
   */
  permission?: Permission | Permission[];
  /** Exact-match active state — for a path that is a prefix of sibling paths. */
  end?: boolean;
}

export interface NavGroupDef {
  label: string;
  items: NavItemDef[];
}

/**
 * The single source of truth for the staff sidebar. `DashboardSidebar`
 * filters this per role and drops any group left empty — see
 * `resolveNavForRole`. Portal navigation (ParentNav / LearnerNav) is
 * purpose-built and intentionally not modelled here.
 */
export const NAV_MODEL: NavGroupDef[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: GridIcon, end: true }],
  },
  {
    label: 'People',
    items: [
      { label: 'Learners', path: '/learners', icon: GraduationCapIcon, permission: 'learner.view' },
      { label: 'Guardians', path: '/guardians', icon: UsersIcon, permission: 'guardian.view' },
      { label: 'Alumni', path: '/alumni', icon: GraduationCapIcon, permission: 'learner.manage' },
      {
        label: 'Safeguarding',
        path: '/safeguarding',
        icon: ShieldIcon,
        permission: 'learner.view_safeguarding',
      },
    ],
  },
  {
    label: 'Admissions',
    items: [
      { label: 'Applications', path: '/admissions', icon: ClipboardListIcon, permission: 'admission.view', end: true },
      {
        label: 'Document Requirements',
        path: '/admissions/requirements',
        icon: BookIcon,
        permission: 'admission.manage',
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      { label: 'Academic Overview', path: '/academic', icon: LayersIcon, permission: 'academic.manage', end: true },
      { label: 'Academic Years', path: '/academic/years', icon: CalendarIcon, permission: 'academic.manage' },
      { label: 'Terms', path: '/academic/terms', icon: BookIcon, permission: 'academic.manage' },
      { label: 'Grades', path: '/academic/grades', icon: LayersIcon, permission: 'academic.manage' },
      { label: 'Classes', path: '/academic/classes', icon: ChalkboardIcon, permission: 'academic.manage' },
      { label: 'Subjects', path: '/academic/subjects', icon: BookIcon, permission: 'academic.manage' },
      {
        label: 'Teaching Assignments',
        path: '/academic/teaching-assignments',
        icon: UsersIcon,
        permission: 'academic.manage',
      },
      {
        // School-level report-card configuration — principal tier only
        // (reportcard.manage alone is also held by teachers / HODs for
        // marking and the HOD-review step, which is not the same thing).
        label: 'Grading Scales',
        path: '/academic/grading-scales',
        icon: LayersIcon,
        permission: 'reportcard.approve',
      },
      {
        label: 'Report Templates',
        path: '/academic/report-templates',
        icon: BookIcon,
        permission: 'reportcard.approve',
      },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { label: 'Attendance', path: '/attendance', icon: CheckIcon, permission: 'attendance.view' },
      { label: 'Assessments', path: '/academic/assessments', icon: ChartIcon, permission: 'assessment.view' },
      { label: 'Homework', path: '/homework', icon: BookIcon, permission: 'assessment.view' },
      { label: 'Report Cards', path: '/report-cards', icon: ClipboardListIcon, permission: 'reportcard.view' },
      { label: 'Timetable', path: '/timetable', icon: CalendarIcon, permission: 'timetable.view' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Finance Overview', path: '/fees', icon: WalletIcon, permission: 'learner.view_financial', end: true },
      { label: 'Invoices', path: '/fees/invoices', icon: WalletIcon, permission: 'learner.view_financial' },
      {
        label: 'Bank Reconciliation',
        path: '/fees/reconciliation',
        icon: WalletIcon,
        permission: 'learner.view_financial',
      },
      {
        label: 'Fee Structures',
        path: '/fees/structures',
        icon: LayersIcon,
        permission: 'learner.manage_financial',
      },
      { label: 'Payment Settings', path: '/fees/settings', icon: GearIcon, permission: 'learner.manage_financial' },
    ],
  },
  {
    label: 'HR',
    items: [
      { label: 'Employees', path: '/employees', icon: BriefcaseIcon, permission: 'employee.view', end: true },
      { label: 'Departments', path: '/employees/departments', icon: LayersIcon, permission: 'employee.view' },
      { label: 'Staff Attendance', path: '/employees/attendance', icon: CheckIcon, permission: 'employee.view' },
      { label: 'Leave Requests', path: '/employees/leave', icon: CalendarIcon, permission: 'employee.view' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Messages', path: '/messages', icon: ChatIcon, end: true },
      { label: 'Announcements', path: '/announcements', icon: MegaphoneIcon },
      { label: 'Notification Preferences', path: '/notifications/settings', icon: GearIcon },
      {
        label: 'Messaging & Delivery',
        path: '/settings/messaging',
        icon: GearIcon,
        permission: 'school.manage',
      },
    ],
  },
  {
    label: 'Reporting',
    items: [{ label: 'Reports', path: '/reports', icon: ChartIcon, permission: 'reports.export' }],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users & Roles', path: '/users', icon: UsersIcon, permission: 'profile.manage_any' },
      { label: 'Schools', path: '/schools', icon: GearIcon, permission: 'tenant.switch' },
      { label: 'School Profile', path: '/school/profile', icon: BuildingIcon, permission: 'school.manage' },
      { label: 'My Profile', path: '/my-profile', icon: UsersIcon },
    ],
  },
];

function itemVisible(role: UserRole | null | undefined, item: NavItemDef): boolean {
  if (!item.permission) return true;
  const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
  return hasAnyPermission(role, perms);
}

/**
 * The role's actual sidebar: every group keeps only the items the role can
 * use, and any group with nothing left is dropped entirely. No disabled
 * rows, no placeholders.
 */
export function resolveNavForRole(role: UserRole | null | undefined): NavGroupDef[] {
  return NAV_MODEL.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemVisible(role, item)),
  })).filter((group) => group.items.length > 0);
}
