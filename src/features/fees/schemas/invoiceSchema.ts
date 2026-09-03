import { z } from 'zod';

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  category: z.enum(['tuition', 'transport', 'boarding', 'uniform', 'activity', 'other']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
});

export const invoiceSchema = z.object({
  dueDate: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  lines: z.array(invoiceLineSchema).min(1, 'Add at least one line item'),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export const invoiceDefaultValues: InvoiceFormValues = {
  dueDate: '',
  notes: '',
  lines: [{ description: '', category: 'tuition', amount: 0 }],
};

export const paymentGatewaySchema = z.object({
  provider: z.enum(['payfast', 'ozow', 'peach', 'yoco', 'netcash']),
  mode: z.enum(['test', 'live']),
  enabled: z.boolean(),
  merchantConfig: z.record(z.string(), z.string().trim()),
});

export type PaymentGatewayFormValues = z.infer<typeof paymentGatewaySchema>;
