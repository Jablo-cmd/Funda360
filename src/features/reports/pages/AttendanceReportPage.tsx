import { useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useAttendanceSummary } from '@/features/attendance/hooks/useAttendanceSummary';
import { useAttendanceReport } from '@/features/reports/hooks/useAttendanceReport';
import { SummaryCard } from '@/features/reports/components/SummaryCard';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';

const BELOW_THRESHOLD_PERCENT = 80;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIsoDate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function AttendanceReportPage() {
  const { can } = usePermissions();
  // Same class-scoped/broad split every other academic-management surface
  // uses (AttendancePage, AssessmentsPage) — this dashboard is the
  // school-wide view, so it requires the broad tier, not just
  // attendance.manage (which teachers also hold for their own class).
  const canView = can('academic.manage');
  const { school } = useSchool();
  const { classes } = useClasses(canView ? school?.id : undefined);
  const classesById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);

  const [startDate, setStartDate] = useState(firstOfMonthIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [classId, setClassId] = useState('');
  const [showBelowThresholdOnly, setShowBelowThresholdOnly] = useState(false);

  const todaySummary = useAttendanceSummary(canView ? school?.id : undefined, todayIsoDate());
  const context = useMemo(() => ({ classesById }), [classesById]);
  const { data, isLoading, error } = useAttendanceReport(
    canView ? school?.id : undefined,
    { startDate, endDate, classId: classId || undefined },
    context,
  );

  // Resolved at render time from the page's own always-current classesById,
  // rather than trusting row.className as computed inside the report
  // fetch: useClasses and useAttendanceReport are two independent async
  // fetches, and if the attendance fetch resolves before the classes fetch
  // does, the report's own className would be permanently baked in as
  // "—" (context is deliberately not a hook dependency — see
  // useAttendanceReport's own comment — so nothing ever re-derives it
  // afterwards). Re-resolving here is a pure, synchronous render-time
  // lookup, so it is correct regardless of which fetch wins the race.
  const resolveClassName = (classId: string, fallback: string) => classesById[classId]?.name ?? fallback;

  const belowThresholdLearners = useMemo(
    () => (data ? data.learnerRows.filter((row) => row.attendanceRate !== null && row.attendanceRate < BELOW_THRESHOLD_PERCENT) : []),
    [data],
  );
  const visibleLearnerRows = showBelowThresholdOnly ? belowThresholdLearners : (data?.learnerRows ?? []);

  if (!canView) {
    return (
      <PageContainer>
        <ErrorAlert message="You don't have permission to view this report." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Attendance report" description="School-wide attendance for the selected period." />

      <div className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-raised p-4 sm:grid-cols-4">
        <div>
          <label htmlFor="attr-start" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            From
          </label>
          <input
            id="attr-start"
            type="date"
            value={startDate}
            max={endDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          />
        </div>
        <div>
          <label htmlFor="attr-end" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            To
          </label>
          <input
            id="attr-end"
            type="date"
            value={endDate}
            min={startDate}
            max={todayIsoDate()}
            onChange={(event) => setEndDate(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label htmlFor="attr-class" className="mb-1.5 block text-xs font-medium text-content-tertiary">
            Class
          </label>
          <select
            id="attr-class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
          >
            <option value="">All classes</option>
            {classes.filter((c) => c.active).map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ErrorAlert message={error} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Present today" value={todaySummary.isLoading ? '—' : String(todaySummary.counts?.present ?? 0)} />
        <SummaryCard label="Absent today" value={todaySummary.isLoading ? '—' : String(todaySummary.counts?.absent ?? 0)} />
        <SummaryCard label="Late today" value={todaySummary.isLoading ? '—' : String(todaySummary.counts?.late ?? 0)} />
        <SummaryCard
          label="Attendance rate (period)"
          value={isLoading ? '—' : data?.overallStats.attendanceRate === null || data?.overallStats.attendanceRate === undefined ? '—' : `${data.overallStats.attendanceRate}%`}
        />
      </dl>

      {!isLoading && belowThresholdLearners.length > 0 && (
        <button
          type="button"
          onClick={() => setShowBelowThresholdOnly((prev) => !prev)}
          className="focus-ring flex items-center justify-between gap-3 rounded-card border border-warning-500/40 bg-warning-50 px-4 py-3 text-left text-sm font-medium text-warning-600 transition-colors hover:border-warning-500/60 dark:bg-warning-500/10 dark:text-warning-500"
        >
          <span>
            {belowThresholdLearners.length} {belowThresholdLearners.length === 1 ? 'learner has' : 'learners have'} attendance below{' '}
            {BELOW_THRESHOLD_PERCENT}%
          </span>
          <span className="shrink-0 font-mono text-xs uppercase tracking-wide">
            {showBelowThresholdOnly ? 'Show all ×' : 'View →'}
          </span>
        </button>
      )}

      {isLoading ? (
        <LoadingBlock label="Loading attendance report…" />
      ) : !data || (data.classRows.length === 0 && data.learnerRows.length === 0) ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No attendance has been recorded for this period yet.
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-content-primary">Attendance by class</h2>
              <ExportCsvButton
                rows={data.classRows}
                columns={[
                  { key: 'className', header: 'Class' },
                  { key: 'present', header: 'Present' },
                  { key: 'absent', header: 'Absent' },
                  { key: 'late', header: 'Late' },
                  { key: 'excused', header: 'Excused' },
                  { key: 'attendanceRate', header: 'Attendance rate %' },
                ]}
                filename="attendance-by-class.csv"
              />
            </div>
            {data.classRows.length === 0 ? (
              <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
                No attendance recorded for this period.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                      <th scope="col" className="px-4 py-3 font-medium">Class</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Present</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Absent</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Late</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Excused</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classRows.map((row) => (
                      <tr key={row.classId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium text-content-primary">{resolveClassName(row.classId, row.className)}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.present}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.absent}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.late}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.excused}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">
                          {row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-content-primary">
                Attendance by learner{showBelowThresholdOnly ? ` (below ${BELOW_THRESHOLD_PERCENT}%)` : ''}
              </h2>
              <ExportCsvButton
                rows={visibleLearnerRows}
                columns={[
                  { key: 'learnerName', header: 'Learner' },
                  { key: 'className', header: 'Class' },
                  { key: 'present', header: 'Present' },
                  { key: 'absent', header: 'Absent' },
                  { key: 'late', header: 'Late' },
                  { key: 'excused', header: 'Excused' },
                  { key: 'attendanceRate', header: 'Attendance rate %' },
                ]}
                filename="attendance-by-learner.csv"
              />
            </div>
            {visibleLearnerRows.length === 0 ? (
              <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
                {showBelowThresholdOnly ? 'No learners below the threshold.' : 'No attendance recorded for this period.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                      <th scope="col" className="px-4 py-3 font-medium">Learner</th>
                      <th scope="col" className="px-4 py-3 font-medium">Class</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Present</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Absent</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Late</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Excused</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLearnerRows.map((row) => (
                      <tr key={row.learnerId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium text-content-primary">{row.learnerName}</td>
                        <td className="px-4 py-3 text-content-secondary">{resolveClassName(row.classId, row.className)}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.present}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.absent}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.late}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">{row.excused}</td>
                        <td className="px-4 py-3 text-right font-mono text-content-secondary">
                          {row.attendanceRate === null ? (
                            '—'
                          ) : (
                            <span className={row.attendanceRate < BELOW_THRESHOLD_PERCENT ? 'font-semibold text-danger-600' : ''}>
                              {row.attendanceRate}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
