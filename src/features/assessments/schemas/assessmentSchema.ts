import { z } from 'zod';

export const assessmentSchema = z.object({
  academicYearId: z.string().trim().min(1, 'Academic year is required'),
  termId: z.string().trim().min(1, 'Term is required'),
  classId: z.string().trim().min(1, 'Class is required'),
  subjectId: z.string().trim().min(1, 'Subject is required'),
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  assessmentType: z.enum(['test', 'assignment', 'examination', 'project', 'quiz'], { message: 'Type is required' }),
  assessmentDate: z.string().trim().min(1, 'Date is required'),
  maxMark: z.coerce
    .number({ message: 'Maximum mark is required' })
    .int('Maximum mark must be a whole number')
    .positive('Maximum mark must be greater than zero'),
});

export type AssessmentFormValues = z.infer<typeof assessmentSchema>;

export const assessmentDefaultValues: AssessmentFormValues = {
  academicYearId: '',
  termId: '',
  classId: '',
  subjectId: '',
  title: '',
  assessmentType: 'test',
  assessmentDate: '',
  maxMark: 100,
};
