import { z } from 'zod';

export const classSchema = z.object({
  gradeId: z.string().trim().min(1, 'Grade is required'),
  name: z.string().trim().min(1, 'Name is required'),
  capacity: z.coerce.number().int('Capacity must be a whole number').min(1, 'Capacity must be at least 1'),
});

export type ClassFormValues = z.infer<typeof classSchema>;

export const classDefaultValues: ClassFormValues = {
  gradeId: '',
  name: '',
  capacity: 30,
};
