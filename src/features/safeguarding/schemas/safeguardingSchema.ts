import { z } from 'zod';

export const safeguardingConcernSchema = z.object({
  category: z.string().trim().optional(),
  description: z.string().trim().min(1, 'A description is required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

export type SafeguardingConcernFormValues = z.infer<typeof safeguardingConcernSchema>;

export const safeguardingConcernDefaultValues: SafeguardingConcernFormValues = {
  category: '',
  description: '',
  severity: 'medium',
};
