import { z } from 'zod';

export const feeStructureSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  category: z.enum(['tuition', 'transport', 'boarding', 'uniform', 'activity', 'other']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  gradeId: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type FeeStructureFormValues = z.infer<typeof feeStructureSchema>;

export const feeStructureDefaultValues: FeeStructureFormValues = {
  name: '',
  category: 'tuition',
  amount: 0,
  gradeId: '',
  description: '',
};
