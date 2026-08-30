import { useState } from 'react';
import { substitutionService } from '@/features/timetable/services/substitutionService';
import { DAY_LABELS } from '@/features/timetable/types/timetable.types';
import type { TimetableEntry } from '@/features/timetable/types/timetable.types';
import type { TimetableSubstitution } from '@/features/timetable/types/substitution.types';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import type { Class, Subject } from '@/features/academic/types/academic.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface SubstitutionsSectionProps {
  substitutions: TimetableSubstitution[];
  entriesById: Record<string, TimetableEntry>;
  classesById: Record<string, Class>;
  subjectsById: Record<string, Subject>;
  teachersById: Record<string, TeacherCandidate>;
  canManage: boolean;
  onCancelled: () => void;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Upcoming and past substitute-teacher cover for the school's whole timetable (FND-TT-004) — not filtered to the page's current class/teacher view, since a manager reviewing cover arrangements wants the complete picture. Purely presentational, matching WeeklyTimetableGrid/ArchivedTimetableEntriesTable's own shape — TimetablePage owns the actual fetch, since it already needs the substitute teachers' profiles resolved alongside every other teacher on the page. */
export function SubstitutionsSection({
  substitutions,
  entriesById,
  classesById,
  subjectsById,
  teachersById,
  canManage,
  onCancelled,
}: SubstitutionsSectionProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setActionError(null);
    setCancellingId(id);
    try {
      await substitutionService.cancelSubstitution(id);
      onCancelled();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to cancel this substitution.'));
    } finally {
      setCancellingId(null);
    }
  };

  if (substitutions.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-content-primary">Substitute teachers</h3>
      {actionError && (
        <div role="alert" className="mb-2 rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {actionError}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {substitutions.map((substitution) => {
          const entry = entriesById[substitution.timetableEntryId];
          const teacher = teachersById[substitution.substituteTeacherProfileId];
          return (
            <li
              key={substitution.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-content-primary">
                  {formatDate(substitution.substituteDate)}
                  {entry ? ` · ${subjectsById[entry.subjectId]?.name ?? 'Subject'} (${classesById[entry.classId]?.name ?? 'Class'})` : ''}
                  {entry ? ` — ${DAY_LABELS[entry.dayOfWeek]} ${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}` : ''}
                </p>
                <p className="text-xs text-content-tertiary">
                  Covered by {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'a substitute teacher'}
                  {substitution.reason ? ` · ${substitution.reason}` : ''}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  disabled={cancellingId === substitution.id}
                  onClick={() => void handleCancel(substitution.id)}
                  className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                >
                  {cancellingId === substitution.id ? 'Cancelling…' : 'Cancel'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
