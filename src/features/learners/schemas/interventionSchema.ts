import { z } from 'zod';

export const interventionSchema = z.object({
  subjectId: z.string().trim().optional(),
  title: z.string().trim().min(1, 'A title is required'),
  description: z.string().trim().optional(),
  targetDate: z.string().trim().optional(),
});

export type InterventionFormValues = z.infer<typeof interventionSchema>;

export const interventionDefaultValues: InterventionFormValues = {
  subjectId: '',
  title: '',
  description: '',
  targetDate: '',
};
