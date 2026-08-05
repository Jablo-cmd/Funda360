import { z } from 'zod';

export const departmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;

export const departmentDefaultValues: DepartmentFormValues = {
  name: '',
  code: '',
  description: '',
};
