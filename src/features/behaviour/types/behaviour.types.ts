import type { BehaviourIncidentType, BehaviourSeverity, BehaviourFollowUpStatus } from '@/lib/database.types';

export type { BehaviourIncidentType, BehaviourSeverity, BehaviourFollowUpStatus };

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
  followUpStatus: BehaviourFollowUpStatus;
  followUpAssignedTo: string | null;
  followUpTargetDate: string | null;
  followUpResolvedAt: string | null;
  guardianVisible: boolean;
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
  followUpAssignedTo?: string | null;
  followUpTargetDate?: string | null;
  guardianVisible?: boolean;
}

export interface UpdateFollowUpInput {
  followUpStatus: BehaviourFollowUpStatus;
  followUpAssignedTo?: string | null;
  followUpTargetDate?: string | null;
}

export interface LearnerBehaviourSummary {
  incidents: BehaviourIncident[];
  hasRecentNegative: boolean;
  positiveCount: number;
  negativeCount: number;
}

/** The deliberately column-narrowed shape a guardian may see — never action_taken/outcome/follow_up_notes. See get_guardian_visible_behaviour_incidents(). */
export interface GuardianVisibleBehaviourIncident {
  id: string;
  learnerId: string;
  incidentType: BehaviourIncidentType;
  severity: BehaviourSeverity | null;
  category: string | null;
  occurredAt: string;
  description: string;
  followUpRequired: boolean;
}
