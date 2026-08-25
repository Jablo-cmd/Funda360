import type { TimelineEvent } from '@/features/learners/types/timeline.types';
import type { LearnerGuardian, LearnerEnrollment } from '@/features/learners/types/learner.types';
import type { LearnerAssessmentResult } from '@/features/assessments/types/assessment.types';
import type { AttendanceRecord } from '@/features/attendance/types/attendance.types';
import type { LearnerFeePayment } from '@/features/fees/types/fee.types';
import type { BehaviourIncident } from '@/features/behaviour/types/behaviour.types';
import { toPercentage } from '@/features/assessments/utils/calculations';

const MAX_EVENTS = 15;

export interface LearnerTimelineInputs {
  results: LearnerAssessmentResult[];
  subjectsById: Record<string, { name: string }>;
  /** Most recent attendance records only (a full history would dwarf every other event type). */
  recentAttendance: AttendanceRecord[];
  guardians: LearnerGuardian[];
  guardianNamesById: Record<string, string>;
  /** Undefined when the caller can't view financial info — those events are simply omitted. */
  feePayments: LearnerFeePayment[] | undefined;
  /** Undefined when the caller can't view behaviour info — those events are simply omitted. */
  behaviourIncidents: BehaviourIncident[] | undefined;
  enrollments: LearnerEnrollment[];
  academicYearNamesById: Record<string, string>;
  gradeNamesById: Record<string, string>;
  classNamesById: Record<string, string>;
}

/**
 * Builds the Learner 360 timeline entirely from data the page has already
 * fetched for its other cards — no additional network requests. Each
 * optional source (fees, behaviour) is simply skipped when the caller
 * doesn't hold that domain's view permission, matching every other
 * permission-gated section on this page.
 */
export function buildLearnerTimeline(inputs: LearnerTimelineInputs): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const result of inputs.results) {
    const percentage = toPercentage(result.mark, result.maxMark);
    const subjectName = inputs.subjectsById[result.subjectId]?.name ?? 'Assessment';
    events.push({
      id: `result-${result.resultId}`,
      date: result.assessmentDate,
      category: 'academic',
      label: `${subjectName} assessment recorded: ${percentage}%`,
    });
  }

  for (const record of inputs.recentAttendance) {
    events.push({
      id: `attendance-${record.id}`,
      date: record.attendanceDate,
      category: 'attendance',
      label: `Learner marked ${record.status}`,
    });
  }

  for (const guardian of inputs.guardians) {
    events.push({
      id: `guardian-${guardian.id}`,
      date: guardian.createdAt,
      category: 'guardian',
      label: `Guardian linked: ${inputs.guardianNamesById[guardian.guardianProfileId] ?? 'Guardian'}`,
    });
  }

  for (const payment of inputs.feePayments ?? []) {
    events.push({
      id: `payment-${payment.id}`,
      date: payment.paymentDate,
      category: 'financial',
      label: `Fee payment recorded: ${new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(payment.amount)}`,
    });
  }

  for (const incident of inputs.behaviourIncidents ?? []) {
    events.push({
      id: `behaviour-${incident.id}`,
      date: incident.occurredAt,
      category: 'behaviour',
      label: `Behaviour note recorded${incident.category ? `: ${incident.category}` : ''}`,
    });
  }

  for (const enrollment of inputs.enrollments) {
    const year = inputs.academicYearNamesById[enrollment.academicYearId] ?? 'academic year';
    const grade = inputs.gradeNamesById[enrollment.gradeId] ?? 'a grade';
    const classPart = enrollment.classId ? ` (${inputs.classNamesById[enrollment.classId] ?? 'class'})` : '';
    events.push({
      id: `enrollment-${enrollment.id}`,
      date: enrollment.enrollmentDate,
      category: 'enrolment',
      label: `Enrolled in ${grade}${classPart} for ${year}`,
    });
  }

  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_EVENTS);
}
