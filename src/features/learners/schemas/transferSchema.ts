import { z } from 'zod';

export const transferSchema = z.object({
  direction: z.enum(['outgoing', 'incoming']),
  otherSchoolName: z.string().trim().min(1, 'The other school\'s name is required'),
  otherSchoolContact: z.string().trim().optional(),
  transferDate: z.string().trim().min(1, 'Transfer date is required'),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type TransferFormValues = z.infer<typeof transferSchema>;

export const transferDefaultValues: TransferFormValues = {
  direction: 'outgoing',
  otherSchoolName: '',
  otherSchoolContact: '',
  transferDate: '',
  reason: '',
  notes: '',
};
