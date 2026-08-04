import { z } from 'zod';
import { isValidSaIdChecksum } from '@/features/learners/utils/saIdNumber';

const MAX_AGE_YEARS = 25;

export const learnerSchema = z
  .object({
    learnerNumber: z.string().trim().min(1, 'Learner number is required'),
    admissionNumber: z.string().trim().min(1, 'Admission number is required'),
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    preferredName: z.string().trim().optional(),
    gender: z.string().trim().optional(),
    dateOfBirth: z.string().trim().min(1, 'Date of birth is required'),
    idNumber: z.string().trim().optional(),
    passportNumber: z.string().trim().optional(),
    passportCountry: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
    homeLanguage: z.string().trim().optional(),
    transportMode: z.string().trim().optional(),
    transportNotes: z.string().trim().optional(),
    boardingType: z.union([z.literal('day_scholar'), z.literal('boarder'), z.literal('')]).optional(),
    admissionDate: z.string().trim().min(1, 'Admission date is required'),
  })
  .refine(
    (values) => {
      const dob = new Date(values.dateOfBirth);
      return dob.getTime() < Date.now();
    },
    { message: 'Date of birth cannot be in the future', path: ['dateOfBirth'] },
  )
  .refine(
    (values) => {
      const dob = new Date(values.dateOfBirth);
      const minDob = new Date();
      minDob.setFullYear(minDob.getFullYear() - MAX_AGE_YEARS);
      return dob.getTime() > minDob.getTime();
    },
    { message: 'Date of birth is not plausible for a learner', path: ['dateOfBirth'] },
  )
  .refine((values) => !values.idNumber || isValidSaIdChecksum(values.idNumber), {
    message: 'Enter a valid South African ID number',
    path: ['idNumber'],
  });

export type LearnerFormValues = z.infer<typeof learnerSchema>;

export const learnerDefaultValues: LearnerFormValues = {
  learnerNumber: '',
  admissionNumber: '',
  firstName: '',
  lastName: '',
  preferredName: '',
  gender: '',
  dateOfBirth: '',
  idNumber: '',
  passportNumber: '',
  passportCountry: '',
  nationality: '',
  homeLanguage: '',
  transportMode: '',
  transportNotes: '',
  boardingType: '',
  admissionDate: '',
};
