import { z } from 'zod';

export const adjustmentSchema = z
  .object({
    adjustmentType: z.enum(['discount', 'bursary', 'scholarship', 'waiver']),
    method: z.enum(['percentage', 'fixed_amount']),
    percentage: z.coerce.number().positive().max(100).optional(),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    reason: z.string().trim().min(1, 'A reason is required for every adjustment'),
    chargeId: z.string().trim().optional(),
  })
  .refine((value) => value.method !== 'percentage' || value.percentage !== undefined, {
    message: 'Enter the percentage this adjustment represents',
    path: ['percentage'],
  });

export type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

export const adjustmentDefaultValues: AdjustmentFormValues = {
  adjustmentType: 'discount',
  method: 'fixed_amount',
  percentage: undefined,
  amount: 0,
  reason: '',
  chargeId: '',
};
