import { z } from 'zod';

export const editUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phone: z.string().trim().optional(),
});

export type EditUserFormValues = z.infer<typeof editUserSchema>;