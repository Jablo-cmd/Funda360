import { z } from 'zod';

export const teachingAssignmentSchema = z.object({
  academicYearId: z.string().trim().min(1, 'Academic year is required'),
  classId: z.string().trim().min(1, 'Class is required'),
  subjectId: z.string().trim().optional(),
  teacherProfileId: z.string().trim().min(1, 'Teacher is required'),
});

export type TeachingAssignmentFormValues = z.infer<typeof teachingAssignmentSchema>;

export const teachingAssignmentDefaultValues: TeachingAssignmentFormValues = {
  academicYearId: '',
  classId: '',
  subjectId: '',
  teacherProfileId: '',
};
