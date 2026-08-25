import type { Class, Subject } from '@/features/academic/types/academic.types';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import type { DayOfWeek } from '@/features/timetable/types/timetable.types';
import { DAYS_OF_WEEK, DAY_LABELS } from '@/features/timetable/types/timetable.types';

export type TimetableViewMode = 'school' | 'class' | 'teacher';

export interface TimetableFiltersBarProps {
  viewMode: TimetableViewMode;
  onViewModeChange: (mode: TimetableViewMode) => void;
  classes: Class[];
  classId: string;
  onClassChange: (classId: string) => void;
  teachers: TeacherCandidate[];
  teacherProfileId: string;
  onTeacherChange: (teacherProfileId: string) => void;
  subjects: Subject[];
  subjectId: string;
  onSubjectChange: (subjectId: string) => void;
  dayOfWeek: DayOfWeek | '';
  onDayChange: (dayOfWeek: DayOfWeek | '') => void;
  showArchived: boolean;
  onShowArchivedChange: (showArchived: boolean) => void;
}

const VIEW_MODES: { key: TimetableViewMode; label: string }[] = [
  { key: 'school', label: 'School' },
  { key: 'class', label: 'Class' },
  { key: 'teacher', label: 'Teacher' },
];

export function TimetableFiltersBar({
  viewMode,
  onViewModeChange,
  classes,
  classId,
  onClassChange,
  teachers,
  teacherProfileId,
  onTeacherChange,
  subjects,
  subjectId,
  onSubjectChange,
  dayOfWeek,
  onDayChange,
  showArchived,
  onShowArchivedChange,
}: TimetableFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit gap-1 rounded-lg border border-border-strong bg-surface-raised p-1">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => onViewModeChange(mode.key)}
            aria-current={viewMode === mode.key ? 'true' : undefined}
            className={`focus-ring rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              viewMode === mode.key
                ? 'bg-brand-600 text-white'
                : 'text-content-secondary hover:bg-surface-sunken hover:text-content-primary'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {viewMode === 'class' && (
          <select
            aria-label="Select class"
            value={classId}
            onChange={(event) => onClassChange(event.target.value)}
            className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-56"
          >
            <option value="">Select a class…</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        )}

        {viewMode === 'teacher' && (
          <select
            aria-label="Select teacher"
            value={teacherProfileId}
            onChange={(event) => onTeacherChange(event.target.value)}
            className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-56"
          >
            <option value="">Select a teacher…</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.firstName} {teacher.lastName}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Filter by subject"
          value={subjectId}
          onChange={(event) => onSubjectChange(event.target.value)}
          className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-48"
        >
          <option value="">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by day"
          value={dayOfWeek}
          onChange={(event) => onDayChange(event.target.value as DayOfWeek | '')}
          className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-40"
        >
          <option value="">All days</option>
          {DAYS_OF_WEEK.map((day) => (
            <option key={day} value={day}>
              {DAY_LABELS[day]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => onShowArchivedChange(event.target.checked)}
            className="focus-ring h-4 w-4 rounded border-border-strong"
          />
          Show archived
        </label>
      </div>
    </div>
  );
}
