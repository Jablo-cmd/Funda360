import type { BehaviourIncidentType, BehaviourSeverity } from '@/lib/database.types';

export type { BehaviourIncidentType, BehaviourSeverity };

export interface BehaviourIncident {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  incidentType: BehaviourIncidentType;
  severity: BehaviourSeverity | null;
  category: string | null;
  occurredAt: string;
  description: string;
  actionTaken: string | null;
  outcome: string | null;
  followUpRequired: boolean;
  followUpNotes: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBehaviourIncidentInput {
  academicYearId: string;
  incidentType: BehaviourIncidentType;
  severity?: BehaviourSeverity | null;
  category?: string | null;
  occurredAt: string;
  description: string;
  actionTaken?: string | null;
  outcome?: string | null;
  followUpRequired?: boolean;
  followUpNotes?: string | null;
}

export interface LearnerBehaviourSummary {
  incidents: BehaviourIncident[];
  hasRecentNegative: boolean;
  positiveCount: number;
  negativeCount: number;
}
