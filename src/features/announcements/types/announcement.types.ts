import type { AnnouncementAudience } from '@/lib/database.types';

export type { AnnouncementAudience };

export interface Announcement {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
}
