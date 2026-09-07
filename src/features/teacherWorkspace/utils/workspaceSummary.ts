import type {
  WorkspaceAttendanceStatus,
  WorkspaceHomework,
  WorkspaceLesson,
} from '@/features/teacherWorkspace/services/teacherWorkspaceService';

/** The lesson happening now or next today, given a HH:MM[:SS] clock. Pure. */
export function currentOrNextLesson(
  lessons: WorkspaceLesson[],
  nowClock: string,
): { lesson: WorkspaceLesson; state: 'now' | 'next' } | null {
  const sorted = [...lessons].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const now = nowClock.slice(0, 8);
  for (const lesson of sorted) {
    if (lesson.startTime <= now && now < lesson.endTime) return { lesson, state: 'now' };
  }
  for (const lesson of sorted) {
    if (lesson.startTime > now) return { lesson, state: 'next' };
  }
  return null;
}

/** Classes whose register has not been taken today. */
export function registersOutstanding(attendance: WorkspaceAttendanceStatus[]): WorkspaceAttendanceStatus[] {
  return attendance.filter((a) => !a.registerTaken);
}

export function totalToMark(homework: WorkspaceHomework[]): number {
  return homework.reduce((sum, h) => sum + h.toMark, 0);
}

export function formatClock(value: string): string {
  return value.slice(0, 5);
}
