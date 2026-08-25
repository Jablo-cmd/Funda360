import { z } from 'zod';

export const timetableEntrySchema = z
  .object({
    academicYearId: z.string().trim().min(1, 'Academic year is required'),
    termId: z.string().trim().optional(),
    classId: z.string().trim().min(1, 'Class is required'),
    subjectId: z.string().trim().min(1, 'Subject is required'),
    teacherProfileId: z.string().trim().min(1, 'Teacher is required'),
    dayOfWeek: z.union([
      z.literal('monday'),
      z.literal('tuesday'),
      z.literal('wednesday'),
      z.literal('thursday'),
      z.literal('friday'),
      z.literal('saturday'),
      z.literal('sunday'),
    ]),
    startTime: z.string().trim().min(1, 'Start time is required'),
    endTime: z.string().trim().min(1, 'End time is required'),
    room: z.string().trim().optional(),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export type TimetableEntryFormValues = z.infer<typeof timetableEntrySchema>;

export const timetableEntryDefaultValues: TimetableEntryFormValues = {
  academicYearId: '',
  termId: '',
  classId: '',
  subjectId: '',
  teacherProfileId: '',
  dayOfWeek: 'monday',
  startTime: '',
  endTime: '',
  room: '',
};
