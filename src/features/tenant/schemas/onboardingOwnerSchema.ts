import { z } from 'zod';

/**
 * A restricted variant of createUserSchema for onboarding wizard Step 2 —
 * a brand-new school's very first account can only sensibly be
 * school_owner or principal (the two roles that can themselves go on to
 * provision every other role for that school); the general 25-role
 * ASSIGNABLE_ROLES list used by the ordinary Add User modal would be
 * actively confusing here.
 */
export const onboardingOwnerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  phone: z.string().trim().optional(),
  role: z.enum(['school_owner', 'principal'], { errorMap: () => ({ message: 'Select a role' }) }),
});

export type OnboardingOwnerFormValues = z.infer<typeof onboardingOwnerSchema>;

export const onboardingOwnerDefaultValues: OnboardingOwnerFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'school_owner',
};
