import { z } from 'zod';

export const gradeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().optional(),
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int('Sort order must be a whole number').min(0, 'Sort order cannot be negative'),
});

export type GradeFormValues = z.infer<typeof gradeSchema>;

export const gradeDefaultValues: GradeFormValues = {
  name: '',
  code: '',
  description: '',
  sortOrder: 0,
};
