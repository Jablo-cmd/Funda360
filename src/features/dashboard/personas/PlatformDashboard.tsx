import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/context/profileContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  BuildingIcon,
  ChartIcon,
  GearIcon,
  ShieldIcon,
  UsersIcon,
} from '@/components/ui/icons';
import {
  DashboardHeading,
  DashboardScreen,
  InfoPanel,
  QuickActionsPanel,
  StatPanel,
  type QuickAction,
} from '@/features/dashboard/components/DashboardPrimitives';

const platformLinks = [
  {
    label: 'Schools',
    description: 'View and administer school tenants across Funda360.',
    to: '/schools',
    icon: BuildingIcon,
  },
  {
    label: 'Users & Roles',
    description: 'Manage platform and school user access.',
    to: '/users',
    icon: UsersIcon,
  },
  {
    label: 'Reports',
    description: 'Open platform reporting and available operational reports.',
    to: '/reports',
    icon: ChartIcon,
  },
  {
    label: 'School Profile',
    description: 'Open the selected school profile when working in a tenant.',
    to: '/school/profile',
    icon: BuildingIcon,
  },
  {
    label: 'Messaging & Delivery',
    description: 'Review school messaging and delivery configuration.',
    to: '/settings/messaging',
    icon: GearIcon,
  },
  {
    label: 'My Profile',
    description: 'Review your platform administrator account.',
    to: '/my-profile',
    icon: UsersIcon,
  },
];

export function PlatformDashboard() {
  const { profile } = useProfile();
  const { can } = usePermissions();

  const quickActions: QuickAction[] = [
    ...(can('tenant.switch')
      ? [{ label: 'Manage Schools', description: 'Open the school tenant directory.', to: '/schools', icon: BuildingIcon }]
      : []),
    ...(can('profile.manage_any')
      ? [{ label: 'Users & Roles', description: 'Manage platform and school access.', to: '/users', icon: UsersIcon }]
      : []),
    { label: 'Reports', description: 'Open available platform and operational reports.', to: '/reports', icon: ChartIcon },
    { label: 'My Profile', description: 'Review your administrator account.', to: '/my-profile', icon: UsersIcon },
  ];

  return (
    <DashboardScreen>
      <DashboardHeading
        title={`Welcome back${profile?.firstName ? `, ${profile.firstName}` : ''}`}
        subtitle={`Platform administration${profile?.role ? ` · ${profile.role.replace(/_/g, ' ')}` : ''}`}
      />

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
          Platform Administration
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {can('tenant.switch') && (
            <StatPanel
              label="School Tenants"
              value="Manage"
              caption="Open the tenant directory"
              to="/schools"
            />
          )}
          {can('profile.manage_any') && (
            <StatPanel
              label="User Administration"
              value="Manage"
              caption="Users, roles and access"
              to="/users"
            />
          )}
          <StatPanel
            label="Platform Reports"
            value="Open"
            caption="Available reporting tools"
            to="/reports"
          />
          <StatPanel
            label="Security & Access"
            value="Admin"
            caption="Review controlled administration areas"
            to="/users"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanel title="Platform Scope">
          <div className="flex items-start gap-3">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" />
            <div className="space-y-2">
              <p className="text-sm text-content-primary">
                This is the platform administration workspace. It is intentionally
                independent of a selected school.
              </p>
              <p className="text-xs text-content-tertiary">
                Select a school from the Schools area when you need to work inside
                a specific tenant. School-level dashboards and operational figures
                belong to that tenant, not this platform view.
              </p>
              {can('tenant.switch') && (
                <Link
                  to="/schools"
                  className="inline-flex text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
                >
                  Open school directory →
                </Link>
              )}
            </div>
          </div>
        </InfoPanel>

        <InfoPanel title="Administration Areas">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {platformLinks
              .filter((link) => {
                if (link.to === '/schools') return can('tenant.switch');
                if (link.to === '/users') return can('profile.manage_any');
                return true;
              })
              .map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-surface-raised"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-content-tertiary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-content-primary">{link.label}</span>
                      <span className="mt-0.5 block text-xs text-content-tertiary">{link.description}</span>
                    </span>
                  </Link>
                );
              })}
          </div>
        </InfoPanel>

        <QuickActionsPanel actions={quickActions} />
      </div>
    </DashboardScreen>
  );
}
