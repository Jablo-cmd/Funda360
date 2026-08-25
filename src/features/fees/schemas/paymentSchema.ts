import { z } from 'zod';

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  paymentDate: z.string().trim().min(1, 'Payment date is required'),
  method: z.enum(['cash', 'eft', 'card', 'debit_order', 'cheque', 'other']),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const paymentDefaultValues: PaymentFormValues = {
  amount: 0,
  paymentDate: '',
  method: 'eft',
  reference: '',
  notes: '',
};
