import { SCHOOL_WEEK_DAYS } from '@/features/timetable/types/timetable.types';
import type { DayOfWeek, TimetableEntry } from '@/features/timetable/types/timetable.types';

export interface SuggestedSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
}

/**
 * The set of (start, end) periods this school already actually uses —
 * derived from its own existing entries, not a hardcoded bell schedule
 * (this platform has no period/bell-schedule subsystem, same reasoning
 * WeeklyTimetableGrid's own doc comment already gives for deriving its
 * rows the same way: "not a hardcoded school-day assumption... stays
 * correct for any of them without guessing a grid resolution").
 */
function getKnownSlots(entries: TimetableEntry[]): TimeSlot[] {
  const slots = new Map<string, TimeSlot>();
  for (const entry of entries) {
    if (!entry.active) continue;
    const key = `${entry.startTime}|${entry.endTime}`;
    if (!slots.has(key)) slots.set(key, { startTime: entry.startTime, endTime: entry.endTime });
  }
  return [...slots.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Assisted slot-suggestion (FND-TT-005) — deliberately NOT a constraint
 * solver that plans an entire timetable (that is FND-TT-006, explicitly
 * scoped separately and deferred). This only answers one narrow question
 * for the one lesson a manager is about to create: "of the periods this
 * school already runs, which day+time combinations are free for both this
 * class and this teacher?" — surfaced as a handful of one-click options
 * in the create form, still leaving every scheduling decision to the
 * human. Weekend days are deliberately excluded, matching the grid's own
 * default-week convention (SCHOOL_WEEK_DAYS) — a school that does
 * genuinely schedule Saturday/Sunday lessons can still pick one manually,
 * the same as today.
 *
 * A slot only needs to be free for the class AND the teacher — room
 * availability is intentionally not modeled here (rooms are picked, if at
 * all, after the day/time is already chosen) and is still fully enforced
 * by the existing server-side conflict trigger at save time regardless.
 */
export function suggestAvailableSlots(
  entries: TimetableEntry[],
  filters: { classId: string; teacherProfileId: string },
  limit = 6,
): SuggestedSlot[] {
  const activeEntries = entries.filter((entry) => entry.active);
  const knownSlots = getKnownSlots(activeEntries);
  if (knownSlots.length === 0) return [];

  const suggestions: SuggestedSlot[] = [];
  for (const day of SCHOOL_WEEK_DAYS) {
    for (const slot of knownSlots) {
      const conflicts = activeEntries.some(
        (entry) =>
          entry.dayOfWeek === day &&
          entry.startTime === slot.startTime &&
          (entry.classId === filters.classId || entry.teacherProfileId === filters.teacherProfileId),
      );
      if (!conflicts) suggestions.push({ dayOfWeek: day, startTime: slot.startTime, endTime: slot.endTime });
      if (suggestions.length >= limit) return suggestions;
    }
  }
  return suggestions;
}
