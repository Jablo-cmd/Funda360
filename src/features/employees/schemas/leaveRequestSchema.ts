import { z } from 'zod';

export const leaveRequestSchema = z
  .object({
    leaveType: z.enum(['annual', 'sick', 'family_responsibility', 'unpaid', 'other']),
    startDate: z.string().trim().min(1, 'Start date is required'),
    endDate: z.string().trim().min(1, 'End date is required'),
    reason: z.string().trim().min(1, 'A reason is required'),
  })
  .refine((values) => values.endDate >= values.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

export const leaveRequestDefaultValues: LeaveRequestFormValues = {
  leaveType: 'annual',
  startDate: '',
  endDate: '',
  reason: '',
};
