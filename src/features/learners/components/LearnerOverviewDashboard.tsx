import { GuardianSummaryCard } from '@/features/learners/components/GuardianSummaryCard';
import { EnrolmentAdminCard } from '@/features/learners/components/EnrolmentAdminCard';
import { MedicalAlertCard } from '@/features/learners/components/MedicalAlertCard';
import { TimelineCard } from '@/features/learners/components/TimelineCard';
import { AlertsBanner } from '@/features/learners/components/AlertsBanner';
import { AcademicSnapshotCard } from '@/features/assessments/components/AcademicSnapshotCard';
import { AttendanceSummaryCard } from '@/features/attendance/components/AttendanceSummaryCard';
import { FinancialSummaryCard } from '@/features/fees/components/FinancialSummaryCard';
import { BehaviourSummaryCard } from '@/features/behaviour/components/BehaviourSummaryCard';
import type { Learner, LearnerGuardian, LearnerEnrollment } from '@/features/learners/types/learner.types';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import type { LearnerMedicalInformation } from '@/features/learners/types/learner.types';
import type { LearnerAssessmentResult } from '@/features/assessments/types/assessment.types';
import type { AcademicYear, Grade, Class, Subject } from '@/features/academic/types/academic.types';
import type { AttendanceStats } from '@/features/attendance/utils/calculations';
import type { LearnerFeeSummary } from '@/features/fees/types/fee.types';
import type { LearnerBehaviourSummary } from '@/features/behaviour/types/behaviour.types';
import type { TimelineEvent } from '@/features/learners/types/timeline.types';
import type { LearnerAlert } from '@/features/learners/utils/learnerAlerts';

export interface LearnerOverviewDashboardProps {
  learner: Learner;
  alerts: LearnerAlert[];

  guardians: LearnerGuardian[];
  guardianCandidatesById: Record<string, GuardianCandidate>;
  guardiansLoading: boolean;
  guardiansError: string | null;
  onViewGuardians: () => void;

  results: LearnerAssessmentResult[];
  subjectsById: Record<string, Subject>;
  resultsLoading: boolean;
  resultsError: string | null;
  onViewResults: () => void;

  attendanceStats: AttendanceStats | null;
  attendanceLoading: boolean;
  attendanceError: string | null;

  canViewFinancial: boolean;
  feeSummary: LearnerFeeSummary | null;
  feeLoading: boolean;
  feeError: string | null;
  onViewFinancial: () => void;

  canViewBehaviour: boolean;
  behaviourSummary: LearnerBehaviourSummary | null;
  behaviourLoading: boolean;
  behaviourError: string | null;
  onViewBehaviour: () => void;

  canViewMedical: boolean;
  medicalInformation: LearnerMedicalInformation | null;
  medicalLoading: boolean;
  medicalError: string | null;
  onViewMedical: () => void;

  enrollments: LearnerEnrollment[];
  academicYears: AcademicYear[];
  grades: Grade[];
  classes: Class[];
  onViewEnrollment: () => void;

  timelineEvents: TimelineEvent[];
}

export function LearnerOverviewDashboard({
  learner,
  alerts,
  guardians,
  guardianCandidatesById,
  guardiansLoading,
  guardiansError,
  onViewGuardians,
  results,
  subjectsById,
  resultsLoading,
  resultsError,
  onViewResults,
  attendanceStats,
  attendanceLoading,
  attendanceError,
  canViewFinancial,
  feeSummary,
  feeLoading,
  feeError,
  onViewFinancial,
  canViewBehaviour,
  behaviourSummary,
  behaviourLoading,
  behaviourError,
  onViewBehaviour,
  canViewMedical,
  medicalInformation,
  medicalLoading,
  medicalError,
  onViewMedical,
  enrollments,
  academicYears,
  grades,
  classes,
  onViewEnrollment,
  timelineEvents,
}: LearnerOverviewDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <AlertsBanner alerts={alerts} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GuardianSummaryCard
          guardians={guardians}
          candidatesById={guardianCandidatesById}
          isLoading={guardiansLoading}
          error={guardiansError}
          onViewAll={onViewGuardians}
        />

        {canViewFinancial && (
          <FinancialSummaryCard summary={feeSummary} isLoading={feeLoading} error={feeError} onViewAll={onViewFinancial} />
        )}

        <AcademicSnapshotCard
          results={results}
          subjectsById={subjectsById}
          isLoading={resultsLoading}
          error={resultsError}
          onViewAll={onViewResults}
        />

        <AttendanceSummaryCard stats={attendanceStats} isLoading={attendanceLoading} error={attendanceError} />

        {canViewBehaviour && (
          <BehaviourSummaryCard
            summary={behaviourSummary}
            isLoading={behaviourLoading}
            error={behaviourError}
            onViewAll={onViewBehaviour}
          />
        )}

        {canViewMedical && (
          <MedicalAlertCard
            medicalInformation={medicalInformation}
            isLoading={medicalLoading}
            error={medicalError}
            onViewDetails={onViewMedical}
          />
        )}

        <EnrolmentAdminCard
          learner={learner}
          enrollments={enrollments}
          academicYears={academicYears}
          grades={grades}
          classes={classes}
          onViewAll={onViewEnrollment}
        />

        <TimelineCard events={timelineEvents} />
      </div>
    </div>
  );
}
