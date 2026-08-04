import { z } from 'zod';

export const documentSchema = z.object({
  documentType: z.union([
    z.literal('birth_certificate'),
    z.literal('id_copy'),
    z.literal('passport'),
    z.literal('permit'),
    z.literal('transfer_letter'),
    z.literal('medical_certificate'),
    z.literal('report_card'),
    z.literal('other'),
  ]),
  fileUrl: z.string().trim().min(1, 'File URL is required'),
  fileName: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type DocumentFormValues = z.infer<typeof documentSchema>;

export const documentDefaultValues: DocumentFormValues = {
  documentType: 'other',
  fileUrl: '',
  fileName: '',
  notes: '',
};
