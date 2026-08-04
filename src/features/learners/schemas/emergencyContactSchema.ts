import { z } from 'zod';

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  relationship: z.string().trim().optional(),
  phone: z.string().trim().min(1, 'Phone number is required'),
  alternatePhone: z.string().trim().optional(),
});

export type EmergencyContactFormValues = z.infer<typeof emergencyContactSchema>;

export const emergencyContactDefaultValues: EmergencyContactFormValues = {
  name: '',
  relationship: '',
  phone: '',
  alternatePhone: '',
};
