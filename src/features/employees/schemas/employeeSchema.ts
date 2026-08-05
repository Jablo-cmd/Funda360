import { z } from 'zod';

const WORK_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const employeeSchema = z.object({
  employeeNumber: z.string().trim().min(1, 'Employee number is required'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  workEmail: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || WORK_EMAIL_PATTERN.test(value), 'Enter a valid email address'),
  workPhone: z.string().trim().optional(),
  idNumber: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  employmentType: z
    .union([z.literal('full_time'), z.literal('part_time'), z.literal('contract'), z.literal('temporary'), z.literal('')])
    .optional(),
  hireDate: z.string().trim().min(1, 'Hire date is required'),
  reportsToEmployeeId: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export const employeeDefaultValues: EmployeeFormValues = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  workEmail: '',
  workPhone: '',
  idNumber: '',
  dateOfBirth: '',
  departmentId: '',
  jobTitle: '',
  employmentType: '',
  hireDate: '',
  reportsToEmployeeId: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};
