import { z } from 'zod';

export const behaviourIncidentSchema = z.object({
  incidentType: z.enum(['positive', 'negative']),
  severity: z.union([z.literal('low'), z.literal('medium'), z.literal('high'), z.literal('')]).optional(),
  category: z.string().trim().optional(),
  occurredAt: z.string().trim().min(1, 'Date is required'),
  description: z.string().trim().min(1, 'Description is required'),
  actionTaken: z.string().trim().optional(),
  outcome: z.string().trim().optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().trim().optional(),
});

export type BehaviourIncidentFormValues = z.infer<typeof behaviourIncidentSchema>;

function nowLocalDatetime(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export const behaviourIncidentDefaultValues: BehaviourIncidentFormValues = {
  incidentType: 'negative',
  severity: '',
  category: '',
  occurredAt: nowLocalDatetime(),
  description: '',
  actionTaken: '',
  outcome: '',
  followUpRequired: false,
  followUpNotes: '',
};
