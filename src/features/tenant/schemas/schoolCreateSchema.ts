import { z } from 'zod';

export const schoolCreateSchema = z.object({
  name: z.string().trim().min(2, 'School name must be at least 2 characters'),
  schoolType: z.enum(['public', 'private', 'independent']),
  status: z.enum(['pending', 'active', 'inactive', 'suspended']),
  province: z.string().trim().optional(),
});

export type SchoolCreateFormValues = z.infer<typeof schoolCreateSchema>;

export const schoolCreateDefaultValues: SchoolCreateFormValues = {
  name: '',
  schoolType: 'public',
  status: 'active',
  province: '',
};
