import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useMyTeachingAssignments } from '@/features/teaching/hooks/useMyTeachingAssignments';
import { useAttendanceRoster } from '@/features/attendance/hooks/useAttendanceRoster';
import { attendanceService } from '@/features/attendance/services/attendanceService';
import type { AttendanceStatus } from '@/features/attendance/types/attendance.types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { getDbErrorMessage } from '@/lib/dbErrors';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
];

const STATUS_BUTTON_CLASSES: Record<AttendanceStatus, string> = {
  present: 'data-[active=true]:bg-success-500/15 data-[active=true]:text-success-500 data-[active=true]:border-success-500/40',
  absent: 'data-[active=true]:bg-danger-50 data-[active=true]:text-danger-600 data-[active=true]:border-danger-500/40',
  late: 'data-[active=true]:bg-warning-50 data-[active=true]:text-warning-600 data-[active=true]:border-warning-500/40 dark:data-[active=true]:bg-warning-500/15 dark:data-[active=true]:text-warning-500',
};

export function AttendancePage() {
  const { can } = usePermissions();
  const canManageAny = can('academic.manage');
  const { school } = useSchool();
  const { currentAcademicYear } = useAcademic();
  const { classes } = useClasses(school?.id);
  const myAssignments = useMyTeachingAssignments();

  const myClassIds = useMemo(() => new Set(myAssignments.data.map((a) => a.classId)), [myAssignments.data]);
  const availableClasses = useMemo(
    () =>
      classes
        .filter((c) => c.active && (canManageAny || myClassIds.has(c.id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [classes, canManageAny, myClassIds],
  );

  const [classId, setClassId] = useState<string>('');
  const [date, setDate] = useState<string>(todayIsoDate());

  useEffect(() => {
    if (!classId && availableClasses.length > 0) setClassId(availableClasses[0]?.id ?? '');
  }, [availableClasses, classId]);

  const canRecordForClass = canManageAny || myClassIds.has(classId);

  const { roster, existingRecords, isLoading, error } = useAttendanceRoster(
    classId || undefined,
    currentAcademicYear?.id,
    date,
  );

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    for (const learner of roster) {
      const existing = existingRecords.find((record) => record.learnerId === learner.id);
      next[learner.id] = existing?.status ?? 'present';
    }
    setStatuses(next);
    setSaved(false);
  }, [roster, existingRecords]);

  const handleSave = async () => {
    if (!school || !currentAcademicYear || !classId) return;
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await attendanceService.saveAttendance(
        school.id,
        currentAcademicYear.id,
        classId,
        date,
        roster.map((learner) => ({ learnerId: learner.id, status: statuses[learner.id] ?? 'present' })),
      );
      // Deliberately not refetching here: `statuses` already reflects
      // exactly what was just persisted (that's what we sent), and the
      // roster/existingRecords effect above resets `saved` to false on
      // every `existingRecords` change (it has to, so switching class/date
      // clears a stale banner) — refetching would immediately clobber the
      // success message that follows.
      setSaved(true);
    } catch (err) {
      setSaveError(getDbErrorMessage(err, 'Failed to save attendance.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Attendance</h1>
        <p className="mt-0.5 text-sm text-content-secondary">Take or review the daily register for a class.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex-1">
          <label htmlFor="attendance-class" className="mb-1.5 block text-sm font-medium text-content-primary">
            Class
          </label>
          {availableClasses.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              {canManageAny ? 'No active classes yet.' : 'You have no assigned classes yet.'}
            </p>
          ) : (
            <select
              id="attendance-class"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-64"
            >
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="attendance-date" className="mb-1.5 block text-sm font-medium text-content-primary">
            Date
          </label>
          <input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="focus-ring h-11 rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          />
        </div>
      </div>

      {!currentAcademicYear && (
        <p className="text-sm text-content-tertiary">Set an active academic year before taking attendance.</p>
      )}

      {(error ?? saveError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error ?? saveError}
        </div>
      )}

      {classId && currentAcademicYear && (
        <div className="rounded-card border border-border bg-surface-raised">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
              />
              <span className="sr-only">Loading register…</span>
            </div>
          ) : roster.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-content-tertiary">No learners enrolled in this class yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                      <th scope="col" className="px-4 py-3 font-medium">
                        Learner
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Learner #
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((learner) => (
                      <tr key={learner.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium text-content-primary">
                          {learner.firstName} {learner.lastName}
                        </td>
                        <td className="px-4 py-3 text-content-secondary">{learner.learnerNumber}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={!canRecordForClass}
                                data-active={statuses[learner.id] === option.value}
                                onClick={() => setStatuses((prev) => ({ ...prev, [learner.id]: option.value }))}
                                className={cn(
                                  'focus-ring rounded-md border border-border-strong px-2.5 py-1 text-xs font-medium text-content-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                  STATUS_BUTTON_CLASSES[option.value],
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canRecordForClass && (
                <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
                  {saved && <span className="text-sm text-success-500">Register saved.</span>}
                  <div className="w-full sm:w-auto sm:min-w-[9rem]">
                    <Button type="button" onClick={() => void handleSave()} isLoading={isSaving}>
                      Save register
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
