import { supabase } from '@/lib/supabase';
import { attendanceService } from '@/features/attendance/services/attendanceService';
import { calculateAttendanceStats } from '@/features/attendance/utils/calculations';
import type { AttendanceStats } from '@/features/attendance/utils/calculations';
import type { AttendanceLearnerSummaryRow, AttendanceClassSummaryRow } from '@/features/reports/types/report.types';
import type { Class } from '@/features/academic/types/academic.types';

export interface AttendanceReportFilters {
  startDate: string;
  endDate: string;
  classId?: string;
}

export interface AttendanceReportContext {
  classesById: Record<string, Class>;
}

export interface AttendanceReport {
  overallStats: AttendanceStats;
  classRows: AttendanceClassSummaryRow[];
  learnerRows: AttendanceLearnerSummaryRow[];
}

/**
 * Assembles the principal/admin attendance report for a date range: the
 * school-wide totals, a per-class breakdown, and a per-learner breakdown
 * (the source both the below-80% alert and its drill-down table read from)
 * — from one shared fetch of the raw records in range, grouped in memory
 * rather than issuing a separate query per class/learner. Every rate is
 * derived through calculateAttendanceStats (utils/calculations), so this
 * report and the teacher-facing register can never disagree about what a
 * rate means.
 */
async function getAttendanceReport(
  schoolId: string,
  filters: AttendanceReportFilters,
  context: AttendanceReportContext,
): Promise<AttendanceReport> {
  const records = await attendanceService.getAttendanceInRange(schoolId, filters.startDate, filters.endDate, filters.classId);

  const overallStats = calculateAttendanceStats(records);

  const byClass = new Map<string, typeof records>();
  const byLearner = new Map<string, typeof records>();
  for (const record of records) {
    const classGroup = byClass.get(record.classId) ?? [];
    classGroup.push(record);
    byClass.set(record.classId, classGroup);

    const learnerGroup = byLearner.get(record.learnerId) ?? [];
    learnerGroup.push(record);
    byLearner.set(record.learnerId, learnerGroup);
  }

  const classRows: AttendanceClassSummaryRow[] = [...byClass.entries()]
    .map(([classId, classRecords]) => ({
      classId,
      className: context.classesById[classId]?.name ?? '—',
      ...calculateAttendanceStats(classRecords),
    }))
    .sort((a, b) => a.className.localeCompare(b.className));

  const learnerIds = [...byLearner.keys()];
  const learnerNamesById = new Map<string, string>();
  if (learnerIds.length > 0) {
    const { data, error } = await supabase.from('learners').select('id, first_name, last_name').in('id', learnerIds);
    if (error) throw error;
    for (const row of data) learnerNamesById.set(row.id, `${row.first_name} ${row.last_name}`);
  }

  const learnerRows: AttendanceLearnerSummaryRow[] = [...byLearner.entries()]
    .map(([learnerId, learnerRecords]) => {
      const classId = learnerRecords[0]?.classId ?? '';
      return {
        learnerId,
        learnerName: learnerNamesById.get(learnerId) ?? 'Unknown learner',
        classId,
        className: context.classesById[classId]?.name ?? '—',
        ...calculateAttendanceStats(learnerRecords),
      };
    })
    .sort((a, b) => a.learnerName.localeCompare(b.learnerName));

  return { overallStats, classRows, learnerRows };
}

export const attendanceReportService = { getAttendanceReport };
