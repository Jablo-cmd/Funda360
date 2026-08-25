import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import type { TimetableEntry } from '@/features/timetable/types/timetable.types';
import { DAY_LABELS } from '@/features/timetable/types/timetable.types';
import type { Class, Subject } from '@/features/academic/types/academic.types';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';

export interface ArchivedTimetableEntriesTableProps {
  entries: TimetableEntry[];
  classesById: Record<string, Class>;
  subjectsById: Record<string, Subject>;
  teachersById: Record<string, TeacherCandidate>;
  canManage: boolean;
  onRestore: (entry: TimetableEntry) => void;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * Archived entries never appear in WeeklyTimetableGrid (which is
 * active-only, per the archive requirement) — this is the one place they
 * remain visible, so a manager can find and restore one archived by
 * mistake without them ever cluttering the live weekly view.
 */
export function ArchivedTimetableEntriesTable({
  entries,
  classesById,
  subjectsById,
  teachersById,
  canManage,
  onRestore,
}: ArchivedTimetableEntriesTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-content-tertiary">No archived lessons.</p>;
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">Class</th>
            <th scope="col" className="px-4 py-3 font-medium">Subject</th>
            <th scope="col" className="px-4 py-3 font-medium">Teacher</th>
            <th scope="col" className="px-4 py-3 font-medium">Day / time</th>
            {canManage && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-content-primary">{classesById[entry.classId]?.name ?? '—'}</td>
              <td className="px-4 py-3 text-content-secondary">{subjectsById[entry.subjectId]?.name ?? '—'}</td>
              <td className="px-4 py-3 text-content-secondary">
                {teachersById[entry.teacherProfileId]
                  ? `${teachersById[entry.teacherProfileId]?.firstName} ${teachersById[entry.teacherProfileId]?.lastName}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-content-secondary">
                {DAY_LABELS[entry.dayOfWeek]}, {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
              </td>
              {canManage && (
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRestore(entry)}
                    className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  >
                    Restore
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScrollContainer>
  );
}
