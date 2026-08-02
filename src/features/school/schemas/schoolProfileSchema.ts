import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^https?:\/\//i.test(value), {
    message: 'Must start with http:// or https://',
  });

export const schoolProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'School name is required')
    .min(2, 'School name must be at least 2 characters'),
  registrationNumber: z.string().trim().optional(),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]).optional(),
  phone: z.string().trim().optional(),
  website: optionalUrl,
  logoUrl: optionalUrl,
  physicalAddress: z.string().trim().optional(),
  postalAddress: z.string().trim().optional(),
  principalName: z.string().trim().optional(),
});

export type SchoolProfileFormValues = z.infer<typeof schoolProfileSchema>;
