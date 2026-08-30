import type { DayOfWeek, TimetableEntryStatus } from '@/lib/database.types';

export type { DayOfWeek, TimetableEntryStatus };

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** The default grid view shows the standard school week — Saturday/Sunday remain selectable in the form for schools that do schedule weekend lessons, but are not part of the primary weekly grid. */
export const SCHOOL_WEEK_DAYS: readonly DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export interface TimetableEntry {
  id: string;
  schoolId: string;
  academicYearId: string;
  termId: string | null;
  classId: string;
  subjectId: string;
  teacherProfileId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string | null;
  status: TimetableEntryStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimetableEntryInput {
  academicYearId: string;
  termId?: string | null;
  classId: string;
  subjectId: string;
  teacherProfileId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
  /** Defaults to 'published' (the DB column's own default) when omitted — draft is an explicit opt-in for staging a batch of changes before revealing them (FND-TT-003). */
  status?: TimetableEntryStatus;
}

export type UpdateTimetableEntryInput = Partial<CreateTimetableEntryInput>;

export interface TimetableEntriesFilters {
  classId?: string;
  teacherProfileId?: string;
  subjectId?: string;
  dayOfWeek?: DayOfWeek;
}
