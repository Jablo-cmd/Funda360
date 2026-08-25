import { Link } from 'react-router-dom';
import { GraduationCapIcon, BriefcaseIcon, LayersIcon, ChartIcon, CheckIcon } from '@/components/ui/icons';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import type { ComponentType, SVGProps } from 'react';
import type { Permission } from '@/features/rbac/types/permission.types';

interface ReportLink {
  label: string;
  description: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  permission: Permission;
}

const LINKS: ReportLink[] = [
  {
    label: 'Learners',
    description: 'Enrollment counts broken down by status.',
    path: '/reports/learners',
    icon: GraduationCapIcon,
    permission: 'learner.view',
  },
  {
    label: 'Employees',
    description: 'Staff counts by department and employment status.',
    path: '/reports/employees',
    icon: BriefcaseIcon,
    permission: 'employee.view',
  },
  {
    label: 'Academic',
    description: 'Active vs. archived counts for years, grades, classes, subjects and terms.',
    path: '/reports/academic',
    icon: LayersIcon,
    permission: 'academic.view',
  },
  {
    label: 'Assessments',
    description: 'Class performance summaries and individual assessment results.',
    path: '/reports/assessments',
    icon: ChartIcon,
    permission: 'assessment.view',
  },
  {
    label: 'Attendance',
    description: 'School-wide attendance rates by class and by learner.',
    path: '/reports/attendance',
    icon: CheckIcon,
    permission: 'academic.manage',
  },
];

export function ReportsOverviewPage() {
  const { can } = usePermissions();
  const visibleLinks = LINKS.filter((link) => can(link.permission));

  return (
    <PageContainer>
      <PageHeader title="Reports" description="Summary reports across your school's data." />

      {visibleLinks.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No reports available for your role.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleLinks.map(({ label, description, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className="focus-ring flex items-start gap-3 rounded-card border border-border bg-surface-raised p-4 shadow-card transition-colors hover:border-brand-500/40 dark:shadow-card-dark"
            >
              <Icon className="h-6 w-6 shrink-0 text-brand-600" />
              <div>
                <p className="font-medium text-content-primary">{label}</p>
                <p className="mt-0.5 text-sm text-content-tertiary">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
