import { z } from 'zod';

export const announcementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Keep the title under 200 characters'),
  body: z.string().trim().min(1, 'Message is required'),
  audience: z.enum(['everyone', 'all_staff', 'all_guardians']),
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export const announcementDefaultValues: AnnouncementFormValues = {
  title: '',
  body: '',
  audience: 'everyone',
};
