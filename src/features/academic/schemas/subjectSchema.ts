import { z } from 'zod';

export const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type SubjectFormValues = z.infer<typeof subjectSchema>;

export const subjectDefaultValues: SubjectFormValues = {
  name: '',
  code: '',
  description: '',
};
