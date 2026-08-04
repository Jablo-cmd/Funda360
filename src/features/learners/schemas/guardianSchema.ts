import { z } from 'zod';

export const guardianSchema = z.object({
  guardianProfileId: z.string().trim().min(1, 'Guardian is required'),
  relationshipType: z.union([
    z.literal('mother'),
    z.literal('father'),
    z.literal('legal_guardian'),
    z.literal('grandparent'),
    z.literal('sibling'),
    z.literal('other'),
  ]),
  isPrimary: z.boolean().optional(),
  custodyNotes: z.string().trim().optional(),
});

export type GuardianFormValues = z.infer<typeof guardianSchema>;

export const guardianDefaultValues: GuardianFormValues = {
  guardianProfileId: '',
  relationshipType: 'mother',
  isPrimary: false,
  custodyNotes: '',
};
