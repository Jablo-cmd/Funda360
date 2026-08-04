import { z } from 'zod';

export const enrollmentSchema = z.object({
  academicYearId: z.string().trim().min(1, 'Academic year is required'),
  gradeId: z.string().trim().min(1, 'Grade is required'),
  classId: z.string().trim().optional(),
  house: z.string().trim().optional(),
  stream: z.string().trim().optional(),
  enrollmentDate: z.string().trim().min(1, 'Enrollment date is required'),
});

export type EnrollmentFormValues = z.infer<typeof enrollmentSchema>;

export const enrollmentDefaultValues: EnrollmentFormValues = {
  academicYearId: '',
  gradeId: '',
  classId: '',
  house: '',
  stream: '',
  enrollmentDate: '',
};
