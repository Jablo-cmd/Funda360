import type { SafeguardingSeverity, SafeguardingStatus } from '@/lib/database.types';

export type { SafeguardingSeverity, SafeguardingStatus };

export interface SafeguardingConcern {
  id: string;
  schoolId: string;
  learnerId: string;
  category: string | null;
  description: string;
  severity: SafeguardingSeverity;
  status: SafeguardingStatus;
  actionTaken: string | null;
  confidentialNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSafeguardingConcernInput {
  category?: string | null;
  description: string;
  severity: SafeguardingSeverity;
}

export interface UpdateSafeguardingConcernInput {
  status?: SafeguardingStatus;
  actionTaken?: string | null;
  confidentialNotes?: string | null;
}
