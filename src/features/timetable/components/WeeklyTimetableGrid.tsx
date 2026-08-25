import { useMemo } from 'react';
import type { TimetableEntry } from '@/features/timetable/types/timetable.types';
import { SCHOOL_WEEK_DAYS, DAY_LABELS } from '@/features/timetable/types/timetable.types';
import type { Class, Subject } from '@/features/academic/types/academic.types';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';

export interface WeeklyTimetableGridProps {
  entries: TimetableEntry[];
  classesById: Record<string, Class>;
  subjectsById: Record<string, Subject>;
  teachersById: Record<string, TeacherCandidate>;
  /** School view (no class/teacher filter) shows the class on each lesson chip; a single-class or single-teacher view omits the now-redundant label. */
  showClassLabel: boolean;
  showTeacherLabel: boolean;
  canManage: boolean;
  onEdit: (entry: TimetableEntry) => void;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * Rows are the distinct start times actually in use, not a hardcoded
 * school-day assumption — schools have different day lengths and lesson
 * durations, and this stays correct for any of them without guessing a
 * grid resolution. A given (day, start_time) cell can hold more than one
 * lesson only in the unfiltered "whole school" view, where different
 * classes legitimately run in parallel; the conflict trigger already
 * guarantees a single class or teacher never has two entries in the same
 * cell.
 */
export function WeeklyTimetableGrid({
  entries,
  classesById,
  subjectsById,
  teachersById,
  showClassLabel,
  showTeacherLabel,
  canManage,
  onEdit,
}: WeeklyTimetableGridProps) {
  const activeEntries = useMemo(() => entries.filter((entry) => entry.active), [entries]);

  const daysWithData = useMemo(() => {
    const present = new Set(activeEntries.map((entry) => entry.dayOfWeek));
    const weekdays = SCHOOL_WEEK_DAYS.filter((day) => present.has(day));
    const weekendDays = (['saturday', 'sunday'] as const).filter((day) => present.has(day));
    return weekdays.length > 0 || weekendDays.length === 0 ? [...SCHOOL_WEEK_DAYS, ...weekendDays] : weekendDays;
  }, [activeEntries]);

  const timeSlots = useMemo(() => {
    const slots = new Map<string, string>();
    for (const entry of activeEntries) slots.set(entry.startTime, entry.endTime);
    return [...slots.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [activeEntries]);

  const entriesByDayAndTime = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    for (const entry of activeEntries) {
      const key = `${entry.dayOfWeek}|${entry.startTime}`;
      const existing = map.get(key);
      if (existing) existing.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [activeEntries]);

  if (timeSlots.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No timetable entries yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-24 px-3 py-3 text-xs font-medium uppercase tracking-wide text-content-tertiary">
              Time
            </th>
            {daysWithData.map((day) => (
              <th key={day} scope="col" className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-content-tertiary">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(([startTime, endTime]) => (
            <tr key={startTime} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-3 align-top font-mono text-xs text-content-tertiary">
                {formatTime(startTime)}–{formatTime(endTime)}
              </td>
              {daysWithData.map((day) => {
                const cellEntries = entriesByDayAndTime.get(`${day}|${startTime}`) ?? [];
                return (
                  <td key={day} className="min-w-[9rem] px-2 py-2 align-top">
                    <div className="flex flex-col gap-1.5">
                      {cellEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={!canManage}
                          onClick={() => onEdit(entry)}
                          className={`focus-ring rounded-lg border border-brand-500/30 bg-brand-50 px-2.5 py-2 text-left dark:bg-brand-500/10 ${
                            canManage ? 'hover:bg-brand-100 dark:hover:bg-brand-500/20' : 'cursor-default'
                          }`}
                        >
                          <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                            {subjectsById[entry.subjectId]?.name ?? 'Subject'}
                          </p>
                          {showClassLabel && (
                            <p className="text-xs text-content-secondary">{classesById[entry.classId]?.name ?? 'Class'}</p>
                          )}
                          {showTeacherLabel && (
                            <p className="text-xs text-content-secondary">
                              {teachersById[entry.teacherProfileId]
                                ? `${teachersById[entry.teacherProfileId]?.firstName} ${teachersById[entry.teacherProfileId]?.lastName}`
                                : 'Teacher'}
                            </p>
                          )}
                          {entry.room && <p className="text-xs text-content-tertiary">{entry.room}</p>}
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
