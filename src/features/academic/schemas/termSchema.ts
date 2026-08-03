import { z } from 'zod';

/** academicYearId is deliberately not part of this schema — it's fixed by which year's Terms page the caller is viewing, not user-editable within the form. See TermFormModal. */
export const termSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    sequence: z.coerce.number().int('Sequence must be a whole number').min(1, 'Sequence must be at least 1'),
    startDate: z.string().trim().min(1, 'Start date is required'),
    endDate: z.string().trim().min(1, 'End date is required'),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate > values.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

export type TermFormValues = z.infer<typeof termSchema>;

export const termDefaultValues: TermFormValues = {
  name: '',
  sequence: 1,
  startDate: '',
  endDate: '',
};
