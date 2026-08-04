import { z } from 'zod';

export const medicalInformationSchema = z.object({
  allergies: z.string().trim().optional(),
  medication: z.string().trim().optional(),
  medicalConditions: z.string().trim().optional(),
  doctorName: z.string().trim().optional(),
  doctorPhone: z.string().trim().optional(),
  medicalAidProvider: z.string().trim().optional(),
  medicalAidNumber: z.string().trim().optional(),
  emergencyMedicalNotes: z.string().trim().optional(),
});

export type MedicalInformationFormValues = z.infer<typeof medicalInformationSchema>;

export const medicalInformationDefaultValues: MedicalInformationFormValues = {
  allergies: '',
  medication: '',
  medicalConditions: '',
  doctorName: '',
  doctorPhone: '',
  medicalAidProvider: '',
  medicalAidNumber: '',
  emergencyMedicalNotes: '',
};
