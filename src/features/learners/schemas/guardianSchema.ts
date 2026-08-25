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
  isEmergencyContact: z.boolean().optional(),
  isAuthorizedPickup: z.boolean().optional(),
  custodyNotes: z.string().trim().optional(),
});

export type GuardianFormValues = z.infer<typeof guardianSchema>;

export const guardianDefaultValues: GuardianFormValues = {
  guardianProfileId: '',
  relationshipType: 'mother',
  isPrimary: false,
  isEmergencyContact: false,
  isAuthorizedPickup: false,
  custodyNotes: '',
};

export const newGuardianSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  idNumber: z.string().trim().optional(),
});

export type NewGuardianFormValues = z.infer<typeof newGuardianSchema>;

export const newGuardianDefaultValues: NewGuardianFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  idNumber: '',
};
