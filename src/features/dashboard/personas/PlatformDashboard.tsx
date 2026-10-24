import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/context/profileContext';
import { BuildingIcon, ChartIcon, ShieldIcon, UsersIcon } from '@/components/ui/icons';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import { formatDateTime, humanise } from '@/features/compliance/utils/formatting';
import { formatStat } from '@/features/dashboard/utils';
import { getPlatformOverview } from '@/features/dashboard/services/platformOverviewService';
import { coverage, platformAttention } from '@/features/dashboard/platformAttention';
import {
  DashboardHeading,
  DashboardScreen,
  EmptyPanelMessage,
  InfoPanel,
  QuickActionsPanel,
  StatPanel,
  type QuickAction,
} from '@/features/dashboard/components/DashboardPrimitives';

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Schools',
    description: 'Add a school or work inside one.',
    to: '/schools',
    icon: BuildingIcon,
  },
  {
    label: 'Users & Roles',
    description: 'Accounts and access across schools.',
    to: '/users',
    icon: UsersIcon,
  },
  {
    label: 'Support Access',
    description: 'Ask a school for time-limited access.',
    to: '/support-access',
    icon: ShieldIcon,
  },
  {
    label: 'Provincial Dashboard',
    description: 'Government reporting.',
    to: '/province',
    icon: ChartIcon,
  },
];

const TH =
  'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary';
const TD = 'px-3 py-2 text-content-primary';

/**
 * The platform owner's dashboard: figures for the whole platform from
 * get_platform_overview() (counts only, no learner or message content),
 * what needs attention, the schools, and recent administrative actions.
 * School figures belong to each school; open a school from Schools to work
 * inside it.
 */
export function PlatformDashboard() {
  const { profile } = useProfile();
  const overview = useAsyncData(getPlatformOverview, [], 'Could not load the platform overview.');
  const data = overview.data;
  const isLoading = overview.isLoading && !data;
  const attention = data ? platformAttention(data) : [];
  const platformMfa = data
    ? coverage(data.security.platform_with_mfa, data.security.platform_accounts)
    : null;
  const privilegedMfa = data
    ? coverage(data.security.privileged_with_mfa, data.security.privileged_accounts)
    : null;

  return (
    <DashboardScreen>
      <DashboardHeading
        title={`Welcome back${profile?.firstName ? `, ${profile.firstName}` : ''}`}
        subtitle={`Platform overview${profile?.role ? ` · ${profile.role.replace(/_/g, ' ')}` : ''}`}
      />
      <ErrorAlert message={overview.error} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPanel
          label="Schools"
          value={data ? formatStat(data.schools.active) : '—'}
          caption={
            data
              ? `active of ${formatStat(data.schools.total)} · ${formatStat(data.schools.created_30d)} new this month`
              : 'Loading'
          }
          to="/schools"
          isLoading={isLoading}
        />
        <StatPanel
          label="Learners"
          value={data ? formatStat(data.learners.active) : '—'}
          caption="active across all schools"
          to="/schools"
          isLoading={isLoading}
        />
        <StatPanel
          label="Active users"
          value={data ? formatStat(data.users.signed_in_30d) : '—'}
          caption={
            data
              ? `signed in this month · ${formatStat(data.users.signed_in_7d)} this week · ${formatStat(data.users.total)} accounts`
              : 'Loading'
          }
          to="/users"
          isLoading={isLoading}
        />
        <StatPanel
          label="Platform MFA"
          value={platformMfa?.text ?? '—'}
          caption={
            privilegedMfa
              ? `platform accounts protected · school leaders ${privilegedMfa.text}`
              : 'Loading'
          }
          to="/my-profile#mfa-security"
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanel title="Needs attention">
          {isLoading ? (
            <EmptyPanelMessage message="Checking the platform…" />
          ) : attention.length === 0 ? (
            <EmptyPanelMessage message="Nothing needs your attention." />
          ) : (
            <ul className="space-y-2">
              {attention.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.severity === 'high' ? 'bg-danger-600' : 'bg-warning-500'}`}
                  />
                  <Link to={item.to} className="text-content-primary">
                    <span className="sr-only">
                      {item.severity === 'high' ? 'Urgent: ' : 'Check: '}
                    </span>
                    {item.message}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </InfoPanel>

        <InfoPanel title="Platform health">
          {data ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <Fact
                label="Database version"
                value={data.health.latest_migration ?? 'Unknown'}
                mono
              />
              <Fact
                label="Scheduled job failures (24 h)"
                value={
                  data.health.scheduled_job_failures_24h === null
                    ? 'Unknown'
                    : formatStat(data.health.scheduled_job_failures_24h)
                }
              />
              <Fact
                label="Notifications waiting to send"
                value={formatStat(data.health.notifications_pending)}
              />
              <Fact
                label="Failed notifications (7 days)"
                value={formatStat(data.health.notifications_failed_7d)}
              />
              <Fact
                label="Unverified payment callbacks (7 days)"
                value={formatStat(data.health.unverified_payment_callbacks_7d)}
              />
              <Fact
                label="Funda AI requests (7 days)"
                value={formatStat(data.health.ai_requests_7d)}
              />
            </dl>
          ) : (
            <EmptyPanelMessage message={isLoading ? 'Loading…' : 'Not available.'} />
          )}
        </InfoPanel>

        <InfoPanel title="Privacy and support access">
          {data ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <Fact
                label="Support requests waiting"
                value={formatStat(data.security.support_pending)}
              />
              <Fact
                label="Support access open now"
                value={formatStat(data.security.support_active)}
              />
              <Fact
                label="Open data subject requests"
                value={formatStat(data.compliance.open_data_requests)}
              />
              <Fact
                label="Overdue data subject requests"
                value={formatStat(data.compliance.overdue_data_requests)}
              />
              <Fact
                label="Open record amendment requests"
                value={formatStat(data.compliance.open_amendment_requests)}
              />
              <Fact
                label="Open content-safety flags"
                value={formatStat(data.compliance.open_content_safety_events)}
              />
            </dl>
          ) : (
            <EmptyPanelMessage message={isLoading ? 'Loading…' : 'Not available.'} />
          )}
        </InfoPanel>

        <InfoPanel title="Government reporting">
          {data ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <Fact label="Education areas" value={formatStat(data.government.education_areas)} />
              <Fact
                label="Schools not linked to an area"
                value={formatStat(data.schools.without_education_area)}
              />
              <Fact
                label="Official access grants"
                value={formatStat(data.government.active_official_assignments)}
              />
              <Fact
                label="Active API clients"
                value={formatStat(data.government.active_api_clients)}
              />
            </dl>
          ) : (
            <EmptyPanelMessage message={isLoading ? 'Loading…' : 'Not available.'} />
          )}
        </InfoPanel>
      </div>

      <InfoPanel title="Schools">
        {data && data.schools.list.length > 0 ? (
          <TableScrollContainer>
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr>
                  <th className={TH}>School</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Learners</th>
                  <th className={`${TH} text-right`}>Staff</th>
                  <th className={`${TH} text-right`}>Guardians</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.schools.list.map((school) => (
                  <tr key={school.id}>
                    <td className={TD}>{school.name}</td>
                    <td className={TD}>{humanise(school.status)}</td>
                    <td className={`${TD} text-right font-mono`}>{formatStat(school.learners)}</td>
                    <td className={`${TD} text-right font-mono`}>{formatStat(school.staff)}</td>
                    <td className={`${TD} text-right font-mono`}>{formatStat(school.guardians)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        ) : (
          <EmptyPanelMessage
            message={isLoading ? 'Loading…' : 'No schools yet. Add one from Schools.'}
          />
        )}
      </InfoPanel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanel title="Recent administrative actions">
          {data && data.recent_admin_actions.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {data.recent_admin_actions.map((action) => (
                <li key={`${action.at}-${action.action}`} className="py-2">
                  <span className="block text-content-primary">{humanise(action.action)}</span>
                  <span className="block text-xs text-content-tertiary">
                    {formatDateTime(action.at)} · {action.by}
                    {action.school ? ` · ${action.school}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanelMessage
              message={isLoading ? 'Loading…' : 'No administrative actions recorded yet.'}
            />
          )}
        </InfoPanel>

        <QuickActionsPanel actions={QUICK_ACTIONS} />
      </div>
    </DashboardScreen>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
      <dt className="text-content-secondary">{label}</dt>
      <dd
        className={`text-right font-semibold text-content-primary ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
