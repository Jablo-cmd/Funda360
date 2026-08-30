import type { ConsentCategory } from '@/lib/database.types';

export type { ConsentCategory };

export interface ConsentRecord {
  id: string;
  schoolId: string;
  learnerId: string;
  guardianProfileId: string;
  category: ConsentCategory;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetConsentInput {
  guardianProfileId: string;
  category: ConsentCategory;
  granted: boolean;
  notes?: string | null;
}
