import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { useLearnersList } from '@/features/learners/hooks/useLearnersList';
import { useEmployeesList } from '@/features/employees/hooks/useEmployeesList';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useAttendanceSummary } from '@/features/attendance/hooks/useAttendanceSummary';
import { attendanceService } from '@/features/attendance/services/attendanceService';
import { calculateAttendanceStats } from '@/features/attendance/utils/calculations';
import { useAssessments } from '@/features/assessments/hooks/useAssessments';
import { feeService } from '@/features/fees/services/feeService';
import { calculateCollectionRate } from '@/features/fees/utils/calculations';
import {
  BriefcaseIcon,
  BuildingIcon,
  ChartIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  MegaphoneIcon,
} from '@/components/ui/icons';
import {
  DashboardHeading,
  DashboardScreen,
  EmptyPanelMessage,
  InfoPanel,
  QuickActionsPanel,
  StatPanel,
  type QuickAction,
} from '@/features/dashboard/components/DashboardPrimitives';
import { formatStat, todayIsoDate } from '@/features/dashboard/utils';

/** Whole-school oversight dashboard — principal, vice principal, school owner. */
export function PrincipalDashboard() {
  const { profile } = useProfile();
  const { tenant } = useTenant();
  const { school } = useSchool();
  const { can } = usePermissions();
  const { currentAcademicYear } = useAcademic();

  const canViewLearners = can('learner.view');
  const canViewEmployees = can('employee.view');
  const canViewFinance = can('learner.view_financial');
  const canViewAdmissions = can('admission.view');

  const learners = useLearnersList(canViewLearners ? school?.id : undefined);
  const employees = useEmployeesList(canViewEmployees ? school?.id : undefined);
  const { classes, isLoading: classesLoading } = useClasses(school?.id);
  const attendance = useAttendanceSummary(school?.id, todayIsoDate());
  const recentAssessments = useAssessments(school?.id, { limit: 3 });

  const activeClassCount = classes.filter((c) => c.active).length;
  const classesById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const todaysAttendanceTotal = attendance.counts
    ? attendance.counts.present + attendance.counts.absent + attendance.counts.late + attendance.counts.excused
    : 0;

  const [collectionRate, setCollectionRate] = useState<number | null>(null);
  const [isCollectionRateLoading, setIsCollectionRateLoading] = useState(true);
  useEffect(() => {
    if (!canViewFinance || !school || !currentAcademicYear) {
      setIsCollectionRateLoading(false);
      return;
    }
    let isMounted = true;
    setIsCollectionRateLoading(true);
    feeService
      .getSchoolFinanceOverview(school.id, currentAcademicYear.id)
      .then((overview) => {
        if (isMounted) setCollectionRate(calculateCollectionRate(overview));
      })
      .catch(() => {
        if (isMounted) setCollectionRate(null);
      })
      .finally(() => {
        if (isMounted) setIsCollectionRateLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [canViewFinance, school, currentAcademicYear]);

  const [attendanceRate30d, setAttendanceRate30d] = useState<number | null>(null);
  const [isAttendanceRateLoading, setIsAttendanceRateLoading] = useState(true);
  useEffect(() => {
    if (!school) {
      setIsAttendanceRateLoading(false);
      return;
    }
    let isMounted = true;
    setIsAttendanceRateLoading(true);
    const endDate = todayIsoDate();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    attendanceService
      .getAttendanceInRange(school.id, startDate, endDate)
      .then((records) => {
        if (isMounted) setAttendanceRate30d(calculateAttendanceStats(records).attendanceRate);
      })
      .catch(() => {
        if (isMounted) setAttendanceRate30d(null);
      })
      .finally(() => {
        if (isMounted) setIsAttendanceRateLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [school]);

  const quickActions: QuickAction[] = [
    ...(canViewLearners
      ? [{ label: 'Learners', description: 'View and manage the learner roster.', to: '/learners', icon: GraduationCapIcon }]
      : []),
    ...(canViewEmployees
      ? [{ label: 'Employees', description: 'View staff records.', to: '/employees', icon: BriefcaseIcon }]
      : []),
    ...(canViewAdmissions
      ? [{ label: 'Admissions', description: 'Applications through to enrolment.', to: '/admissions', icon: ClipboardListIcon }]
      : []),
    { label: 'Reports', description: 'Learner, staff, academic and attendance reports.', to: '/reports', icon: ChartIcon },
    { label: 'Announcements', description: 'Post a school-wide announcement.', to: '/announcements', icon: MegaphoneIcon },
    { label: 'School Profile', description: 'Contact details, address and branding.', to: '/school/profile', icon: BuildingIcon },
  ];

  return (
    <DashboardScreen>
      <DashboardHeading
        title={`Welcome back${profile?.firstName ? `, ${profile.firstName}` : ''}`}
        subtitle={`${profile?.role ? profile.role.replace(/_/g, ' ') : 'No role assigned'}${
          tenant?.school.name ? ` at ${tenant.school.name}` : ''
        }`}
      />

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
          Executive Summary
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {canViewLearners && (
            <StatPanel
              label="Active Learners"
              value={formatStat(learners.totalCount)}
              caption="Current enrolment"
              to="/learners"
              isLoading={learners.isLoading}
            />
          )}
          {canViewEmployees && (
            <StatPanel
              label="Active Employees"
              value={formatStat(employees.totalCount)}
              caption="Current staff complement"
              to="/employees"
              isLoading={employees.isLoading}
            />
          )}
          <StatPanel
            label="Classes"
            value={formatStat(activeClassCount)}
            caption="Active this year"
            to="/academic/classes"
            isLoading={classesLoading}
          />
          <StatPanel
            label="Today's Attendance"
            value={formatStat(todaysAttendanceTotal)}
            caption="Registers taken today"
            to="/attendance"
            isLoading={attendance.isLoading}
          />
          <StatPanel
            label="30-Day Attendance Rate"
            value={attendanceRate30d !== null ? `${attendanceRate30d}%` : '—'}
            caption="Present or late, last 30 days"
            to="/reports/attendance"
            isLoading={isAttendanceRateLoading}
          />
          {canViewFinance && (
            <StatPanel
              label="Fee Collection Rate"
              value={collectionRate !== null ? `${collectionRate}%` : '—'}
              caption="Net collected vs. billed, this year"
              to="/fees"
              isLoading={isCollectionRateLoading}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanel title="Attendance Overview">
          {attendance.isLoading ? (
            <EmptyPanelMessage message="Loading today's attendance…" />
          ) : todaysAttendanceTotal > 0 && attendance.counts ? (
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div>
                <span className="font-mono text-2xl font-semibold text-success-500">
                  {formatStat(attendance.counts.present)}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-content-tertiary">Present</span>
              </div>
              <div>
                <span className="font-mono text-2xl font-semibold text-danger-600">
                  {formatStat(attendance.counts.absent)}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-content-tertiary">Absent</span>
              </div>
              <div>
                <span className="font-mono text-2xl font-semibold text-warning-600 dark:text-warning-500">
                  {formatStat(attendance.counts.late)}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-content-tertiary">Late</span>
              </div>
              <div>
                <span className="font-mono text-2xl font-semibold text-brand-600 dark:text-brand-300">
                  {formatStat(attendance.counts.excused)}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-content-tertiary">Excused</span>
              </div>
            </div>
          ) : (
            <EmptyPanelMessage message="No attendance recorded for today yet." />
          )}
        </InfoPanel>

        <InfoPanel title="Recent Assessments">
          {recentAssessments.isLoading ? (
            <EmptyPanelMessage message="Loading recent assessments…" />
          ) : recentAssessments.assessments.length === 0 ? (
            <EmptyPanelMessage message="No assessments have been created yet." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentAssessments.assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  to={`/academic/assessments/${assessment.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors first:pt-0 last:pb-0 hover:text-brand-600 dark:hover:text-brand-300"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-content-primary">{assessment.title}</span>
                    <span className="block truncate text-xs text-content-tertiary">
                      {classesById[assessment.classId]?.name ?? 'Class'}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-content-tertiary">
                    {new Date(`${assessment.assessmentDate}T00:00:00`).toLocaleDateString('en-ZA', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </InfoPanel>

        <QuickActionsPanel actions={quickActions} />
      </div>
    </DashboardScreen>
  );
}
