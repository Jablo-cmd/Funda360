import type { AttendanceStats } from '@/features/attendance/utils/calculations';
import type { LearnerFeeSummary } from '@/features/fees/types/fee.types';
import type { LearnerBehaviourSummary } from '@/features/behaviour/types/behaviour.types';

/** Below this attendance rate, the learner is flagged — matches no existing documented threshold (none exists anywhere in this schema); a reasonable, clearly-labelled default. */
const ATTENDANCE_ALERT_THRESHOLD = 90;
/** Below this overall average, academic performance is flagged. */
const ACADEMIC_ALERT_THRESHOLD = 50;

export interface LearnerAlertsInputs {
  guardianCount: number;
  hasEmergencyContact: boolean;
  attendanceStats: AttendanceStats | null;
  overallAveragePercentage: number | null;
  /** Undefined when the caller can't view financial info — that alert is simply omitted. */
  feeSummary: LearnerFeeSummary | null | undefined;
  /** Undefined when the caller can't view behaviour info — that alert is simply omitted. */
  behaviourSummary: LearnerBehaviourSummary | null | undefined;
  /** Undefined when the caller can't view medical info — that alert is simply omitted. */
  hasMedicalInfoOnFile: boolean | undefined;
}

export interface LearnerAlert {
  id: string;
  message: string;
}

/**
 * Every alert here is derived from data the page has already fetched for
 * its own cards — no extra queries, and a domain the viewer can't see
 * (fees/behaviour/medical passed as `undefined`) never produces an alert
 * for them, matching the section's own visibility.
 */
export function deriveLearnerAlerts(inputs: LearnerAlertsInputs): LearnerAlert[] {
  const alerts: LearnerAlert[] = [];

  // totalCharged > 0 matters here: deriveFeeStatus() returns 'outstanding'
  // for a learner with zero charges on file too (nothing to compute a
  // status from) — that's a "no data yet" state, not something requiring
  // attention, so it must never surface as a fees alert.
  if (
    inputs.feeSummary &&
    inputs.feeSummary.totalCharged > 0 &&
    (inputs.feeSummary.status === 'outstanding' || inputs.feeSummary.status === 'overdue')
  ) {
    alerts.push({
      id: 'fees-outstanding',
      message: inputs.feeSummary.status === 'overdue' ? 'Fees overdue' : 'Fees outstanding',
    });
  }

  if (inputs.attendanceStats && inputs.attendanceStats.attendanceRate !== null && inputs.attendanceStats.attendanceRate < ATTENDANCE_ALERT_THRESHOLD) {
    alerts.push({ id: 'attendance-low', message: `Attendance below ${ATTENDANCE_ALERT_THRESHOLD}% (currently ${inputs.attendanceStats.attendanceRate}%)` });
  }

  if (inputs.overallAveragePercentage !== null && inputs.overallAveragePercentage < ACADEMIC_ALERT_THRESHOLD) {
    alerts.push({ id: 'academic-low', message: `Academic average below ${ACADEMIC_ALERT_THRESHOLD}% (currently ${inputs.overallAveragePercentage}%)` });
  }

  if (inputs.behaviourSummary?.hasRecentNegative) {
    alerts.push({ id: 'behaviour-attention', message: 'Recent behaviour incident on file' });
  }

  if (inputs.guardianCount === 0) {
    alerts.push({ id: 'guardian-missing', message: 'No guardian on file' });
  }

  if (!inputs.hasEmergencyContact) {
    alerts.push({ id: 'emergency-contact-missing', message: 'No emergency contact on file' });
  }

  if (inputs.hasMedicalInfoOnFile === false) {
    alerts.push({ id: 'medical-missing', message: 'No medical information on file' });
  }

  return alerts;
}
