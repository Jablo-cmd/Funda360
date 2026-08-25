import { z } from 'zod';

export const feeChargeSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  category: z.enum(['tuition', 'transport', 'boarding', 'uniform', 'activity', 'other']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  dueDate: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type FeeChargeFormValues = z.infer<typeof feeChargeSchema>;

export const feeChargeDefaultValues: FeeChargeFormValues = {
  description: '',
  category: 'tuition',
  amount: 0,
  dueDate: '',
  notes: '',
};
