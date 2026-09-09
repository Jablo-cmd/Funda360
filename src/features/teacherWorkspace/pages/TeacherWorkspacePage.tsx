import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useProfile } from '@/features/profile/context/profileContext';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useUnreadConversationCount } from '@/features/messaging/hooks/useUnreadConversationCount';
import { useTeacherWorkspace } from '@/features/teacherWorkspace/hooks/useTeacherWorkspace';
import {
  currentOrNextLesson,
  formatClock,
  registersOutstanding,
  totalToMark,
} from '@/features/teacherWorkspace/utils/workspaceSummary';

// Every entry links somewhere a teacher can actually go — a teacher holds
// no `learner.view`, so a "View learners" action (which RequirePermission
// would bounce straight back to /dashboard) is deliberately absent.
const QUICK_ACTIONS = [
  { label: 'Take attendance', to: '/attendance' },
  { label: 'Enter marks', to: '/academic/assessments' },
  { label: 'Create homework', to: '/homework' },
  { label: 'Message parents', to: '/messages' },
];

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-tertiary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TeacherWorkspacePage() {
  const { school } = useSchool();
  const { profile } = useProfile();
  const { currentAcademicYear } = useAcademic();
  const schoolId = school?.id ?? undefined;
  const { workspace, isLoading, error } = useTeacherWorkspace(schoolId, currentAcademicYear?.id);
  const { unreadCount } = useNotifications(profile?.id);
  const unreadMessages = useUnreadConversationCount(profile?.id);

  if (!schoolId) {
    return (
      <PageContainer>
        <PageHeader title="My Classes" />
        <NoActiveSchoolNotice resource="your workspace" />
      </PageContainer>
    );
  }

  const firstName = profile?.firstName ?? 'there';
  const nextLesson = workspace ? currentOrNextLesson(workspace.todayLessons, new Date().toTimeString().slice(0, 8)) : null;
  const outstandingRegisters = workspace ? registersOutstanding(workspace.attendance) : [];
  const toMark = workspace ? totalToMark(workspace.homeworkToMark) : 0;

  return (
    <PageContainer>
      <PageHeader title={`Good day, ${firstName}`} description="Everything for your teaching day, in one place." />
      <ErrorAlert message={error} />

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="focus-ring rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium text-content-primary hover:bg-surface-sunken"
          >
            {a.label}
          </Link>
        ))}
      </div>

      {isLoading || !workspace ? (
        <LoadingBlock label="Loading your workspace…" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Today's lessons">
            {workspace.todayLessons.length === 0 ? (
              <p className="text-sm text-content-tertiary">No lessons scheduled today.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {workspace.todayLessons.map((l) => {
                  const isNow = nextLesson?.lesson.id === l.id && nextLesson.state === 'now';
                  return (
                    <li
                      key={l.id}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${isNow ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
                    >
                      <span className="font-medium text-content-primary">
                        {formatClock(l.startTime)}–{formatClock(l.endTime)} · {l.className}
                      </span>
                      <span className="text-content-tertiary">
                        {l.subjectName}
                        {l.room ? ` · ${l.room}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Attendance" action={<Link to="/attendance" className="text-xs text-brand-600 underline">Open</Link>}>
            {workspace.attendance.length === 0 ? (
              <p className="text-sm text-content-tertiary">You are not assigned to any classes.</p>
            ) : outstandingRegisters.length === 0 ? (
              <p className="text-sm text-success-600">All registers taken for today.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {outstandingRegisters.map((a) => (
                  <li key={a.classId} className="text-content-secondary">
                    <span className="text-danger-600">●</span> {a.className} — register not taken
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Homework to mark" action={<Link to="/homework" className="text-xs text-brand-600 underline">Open</Link>}>
            {toMark === 0 ? (
              <p className="text-sm text-content-tertiary">Nothing waiting to be marked.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {workspace.homeworkToMark.map((h) => (
                  <li key={h.id}>
                    <Link to={`/homework/${h.id}`} className="text-content-primary hover:underline">
                      {h.title} <span className="text-content-tertiary">· {h.className}</span>
                    </Link>{' '}
                    <span className="rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      {h.toMark}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Upcoming assessments" action={<Link to="/academic/assessments" className="text-xs text-brand-600 underline">Open</Link>}>
            {workspace.upcomingAssessments.length === 0 ? (
              <p className="text-sm text-content-tertiary">No assessments in the next two weeks.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {workspace.upcomingAssessments.map((a) => (
                  <li key={a.id}>
                    <Link to={`/academic/assessments/${a.id}`} className="text-content-primary hover:underline">
                      {new Date(a.assessmentDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })} · {a.title}
                    </Link>{' '}
                    <span className="text-content-tertiary">
                      {a.className} · {a.subjectName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="My classes">
            {workspace.classes.length === 0 ? (
              <p className="text-sm text-content-tertiary">No classes assigned.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 text-sm">
                {workspace.classes.map((c) => (
                  <li key={`${c.classId}-${c.subjectId ?? 'all'}`} className="rounded-full bg-surface-sunken px-2.5 py-1">
                    {c.className}
                    {c.subjectName ? ` · ${c.subjectName}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Inbox">
            <ul className="flex flex-col gap-1 text-sm">
              <li>
                <Link to="/messages" className="text-content-primary hover:underline">
                  Messages
                </Link>{' '}
                {unreadMessages > 0 && (
                  <span className="rounded bg-brand-100 px-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    {unreadMessages}
                  </span>
                )}
              </li>
              <li>
                <Link to="/notifications" className="text-content-primary hover:underline">
                  Notifications
                </Link>{' '}
                {unreadCount > 0 && (
                  <span className="rounded bg-brand-100 px-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    {unreadCount}
                  </span>
                )}
              </li>
            </ul>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
