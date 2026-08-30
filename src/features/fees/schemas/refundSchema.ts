import { z } from 'zod';

export const refundSchema = z.object({
  paymentId: z.string().trim().min(1, 'Select the payment being refunded'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  refundDate: z.string().trim().min(1, 'Refund date is required'),
  method: z.enum(['cash', 'eft', 'card', 'debit_order', 'cheque', 'other']),
  reference: z.string().trim().optional(),
  reason: z.string().trim().min(1, 'A reason is required for every refund'),
  status: z.enum(['pending', 'completed', 'rejected']),
});

export type RefundFormValues = z.infer<typeof refundSchema>;

export const refundDefaultValues: RefundFormValues = {
  paymentId: '',
  amount: 0,
  refundDate: '',
  method: 'eft',
  reference: '',
  reason: '',
  status: 'pending',
};
