import { z } from 'zod';

export const gradingBandSchema = z
  .object({
    code: z.string().trim().min(1, 'Code is required').max(12, 'Keep the code short'),
    label: z.string().trim().min(1, 'A label is required').max(80),
    descriptor: z.string().trim().max(240).optional().or(z.literal('')),
    minPercentage: z.coerce.number().int().min(0).max(100),
    maxPercentage: z.coerce.number().int().min(0).max(100),
  })
  .refine((band) => band.minPercentage <= band.maxPercentage, {
    message: 'Minimum cannot exceed maximum',
    path: ['minPercentage'],
  });

export const gradingScaleSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(80),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  isDefault: z.boolean(),
  bands: z
    .array(gradingBandSchema)
    .min(1, 'Add at least one band')
    .refine(
      (bands) => {
        const sorted = [...bands].sort((a, b) => a.minPercentage - b.minPercentage);
        for (let i = 1; i < sorted.length; i += 1) {
          const current = sorted[i];
          const previous = sorted[i - 1];
          if (current && previous && current.minPercentage <= previous.maxPercentage) return false;
        }
        return true;
      },
      { message: 'Bands must not overlap' },
    ),
});

export type GradingScaleFormValues = z.infer<typeof gradingScaleSchema>;

export const gradingScaleDefaultValues: GradingScaleFormValues = {
  name: '',
  description: '',
  isDefault: false,
  bands: [{ code: '', label: '', descriptor: '', minPercentage: 0, maxPercentage: 100 }],
};

export const reportCardTemplateSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(80),
  gradingScaleId: z.string().uuid('Choose a grading scale'),
  isDefault: z.boolean(),
  requiresHodReview: z.boolean(),
  showAttendance: z.boolean(),
  showConduct: z.boolean(),
  showClassTeacherComment: z.boolean(),
  showPrincipalComment: z.boolean(),
  showSubjectComments: z.boolean(),
  showPromotion: z.boolean(),
  headerNote: z.string().trim().max(500).optional().or(z.literal('')),
  footerNote: z.string().trim().max(500).optional().or(z.literal('')),
});

export type ReportCardTemplateFormValues = z.infer<typeof reportCardTemplateSchema>;

export const reportCardTemplateDefaultValues: ReportCardTemplateFormValues = {
  name: '',
  gradingScaleId: '',
  isDefault: false,
  requiresHodReview: false,
  showAttendance: true,
  showConduct: true,
  showClassTeacherComment: true,
  showPrincipalComment: true,
  showSubjectComments: true,
  showPromotion: true,
  headerNote: '',
  footerNote: '',
};
