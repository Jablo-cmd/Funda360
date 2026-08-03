import { z } from 'zod';

export const academicYearSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    startDate: z.string().trim().min(1, 'Start date is required'),
    endDate: z.string().trim().min(1, 'End date is required'),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate > values.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

export type AcademicYearFormValues = z.infer<typeof academicYearSchema>;

export const academicYearDefaultValues: AcademicYearFormValues = {
  name: '',
  startDate: '',
  endDate: '',
};
