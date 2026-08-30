import { describe, expect, it } from 'vitest';
import { suggestAvailableSlots } from './suggestSlots';
import type { TimetableEntry } from '@/features/timetable/types/timetable.types';

function buildEntry(overrides: Partial<TimetableEntry> = {}): TimetableEntry {
  return {
    id: overrides.id ?? 'entry-1',
    schoolId: 'school-1',
    academicYearId: 'year-1',
    termId: null,
    classId: 'class-8a',
    subjectId: 'subject-math',
    teacherProfileId: 'teacher-1',
    dayOfWeek: 'monday',
    startTime: '08:00:00',
    endTime: '08:45:00',
    room: null,
    status: 'published',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('suggestAvailableSlots', () => {
  it('returns nothing when there are no existing entries to derive a period template from', () => {
    expect(suggestAvailableSlots([], { classId: 'class-8a', teacherProfileId: 'teacher-1' })).toEqual([]);
  });

  it('suggests every known slot on every school-week day when nothing conflicts', () => {
    // One entry just to establish the known 08:00-08:45 period, for an
    // unrelated class/teacher — so it never conflicts with the query.
    const entries = [buildEntry({ classId: 'class-9a', teacherProfileId: 'teacher-2' })];
    const suggestions = suggestAvailableSlots(entries, { classId: 'class-8a', teacherProfileId: 'teacher-1' });
    expect(suggestions).toHaveLength(5); // Monday..Friday
    expect(suggestions.every((s) => s.startTime === '08:00:00' && s.endTime === '08:45:00')).toBe(true);
    expect(suggestions.map((s) => s.dayOfWeek)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  });

  it('excludes a day+slot where the requested class already has a lesson', () => {
    const entries = [buildEntry({ id: 'entry-1', dayOfWeek: 'monday', classId: 'class-8a', teacherProfileId: 'teacher-9' })];
    const suggestions = suggestAvailableSlots(entries, { classId: 'class-8a', teacherProfileId: 'teacher-1' });
    expect(suggestions.find((s) => s.dayOfWeek === 'monday')).toBeUndefined();
    expect(suggestions.find((s) => s.dayOfWeek === 'tuesday')).toBeDefined();
  });

  it('excludes a day+slot where the requested teacher already has a lesson, even for a different class', () => {
    const entries = [buildEntry({ id: 'entry-1', dayOfWeek: 'wednesday', classId: 'class-9a', teacherProfileId: 'teacher-1' })];
    const suggestions = suggestAvailableSlots(entries, { classId: 'class-8a', teacherProfileId: 'teacher-1' });
    expect(suggestions.find((s) => s.dayOfWeek === 'wednesday')).toBeUndefined();
  });

  it('ignores archived (active: false) entries entirely, both as the period template and as a conflict', () => {
    const entries = [
      buildEntry({ id: 'entry-1', dayOfWeek: 'monday', classId: 'class-8a', active: false, startTime: '10:00:00', endTime: '10:45:00' }),
    ];
    const suggestions = suggestAvailableSlots(entries, { classId: 'class-8a', teacherProfileId: 'teacher-1' });
    // The only entry is archived, so there is no known period at all.
    expect(suggestions).toEqual([]);
  });

  it('derives multiple distinct known periods and suggests across all of them', () => {
    const entries = [
      buildEntry({ id: 'entry-1', classId: 'class-9a', startTime: '08:00:00', endTime: '08:45:00' }),
      buildEntry({ id: 'entry-2', classId: 'class-9a', startTime: '09:00:00', endTime: '09:45:00' }),
    ];
    const suggestions = suggestAvailableSlots(entries, { classId: 'class-8a', teacherProfileId: 'teacher-1' }, 20);
    const distinctSlots = new Set(suggestions.map((s) => s.startTime));
    expect(distinctSlots).toEqual(new Set(['08:00:00', '09:00:00']));
  });

  it('respects the limit parameter', () => {
    const entries = [buildEntry({ classId: 'class-9a' })];
    const suggestions = suggestAvailableSlots(entries, { classId: 'class-8a', teacherProfileId: 'teacher-1' }, 3);
    expect(suggestions).toHaveLength(3);
  });
});
