import { describe, expect, it } from 'vitest';
import {
  currentOrNextLesson,
  registersOutstanding,
  totalToMark,
  formatClock,
} from './workspaceSummary';
import type {
  WorkspaceAttendanceStatus,
  WorkspaceHomework,
  WorkspaceLesson,
} from '@/features/teacherWorkspace/services/teacherWorkspaceService';

const lesson = (id: string, startTime: string, endTime: string): WorkspaceLesson => ({
  id,
  classId: `c-${id}`,
  className: `Class ${id}`,
  subjectName: 'Maths',
  startTime,
  endTime,
  room: null,
});

describe('currentOrNextLesson', () => {
  const lessons = [lesson('a', '08:00:00', '08:45:00'), lesson('b', '09:00:00', '09:45:00')];

  it('returns the lesson in progress', () => {
    expect(currentOrNextLesson(lessons, '08:30')).toEqual({ lesson: lessons[0], state: 'now' });
  });
  it('returns the next lesson when between lessons', () => {
    expect(currentOrNextLesson(lessons, '08:50')).toEqual({ lesson: lessons[1], state: 'next' });
  });
  it('returns null after the last lesson', () => {
    expect(currentOrNextLesson(lessons, '10:00')).toBeNull();
  });
  it('returns null with no lessons', () => {
    expect(currentOrNextLesson([], '10:00')).toBeNull();
  });
});

describe('registersOutstanding', () => {
  it('keeps only classes without a register', () => {
    const attendance: WorkspaceAttendanceStatus[] = [
      { classId: 'a', className: 'A', registerTaken: true },
      { classId: 'b', className: 'B', registerTaken: false },
    ];
    expect(registersOutstanding(attendance).map((a) => a.classId)).toEqual(['b']);
  });
});

describe('totalToMark', () => {
  it('sums the per-assignment counts', () => {
    const homework: WorkspaceHomework[] = [
      { id: '1', title: 'A', className: 'A', dueAt: null, toMark: 3 },
      { id: '2', title: 'B', className: 'B', dueAt: null, toMark: 4 },
    ];
    expect(totalToMark(homework)).toBe(7);
  });
});

describe('formatClock', () => {
  it('trims seconds', () => {
    expect(formatClock('08:45:00')).toBe('08:45');
  });
});
