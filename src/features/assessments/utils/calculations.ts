/**
 * Centralized assessment-mark calculations — every component that needs a
 * percentage, average, or completion count goes through here rather than
 * recomputing it inline, per the sprint brief's explicit "do not duplicate
 * calculation logic throughout the UI" instruction.
 *
 * Rounding rule (deliberately different per use): a single learner's
 * percentage (42/50 -> "84%") rounds to a whole number — that's what the
 * mark-entry table and results views display per-row. The completion
 * summary's average mark/percentage rounds to one decimal place
 * (72.4%) — matching the sprint brief's own worked example — since an
 * average is a computed statistic, not a literal score, and one decimal
 * distinguishes close averages without implying false precision.
 */

export interface MarkStats {
  totalCount: number;
  markedCount: number;
  unmarkedCount: number;
  averageMark: number | null;
  averagePercentage: number | null;
  highestMark: number | null;
  lowestMark: number | null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** A single learner's mark as a whole-number percentage — e.g. toPercentage(42, 50) -> 84. */
export function toPercentage(mark: number, maxMark: number): number {
  if (maxMark <= 0) return 0;
  return round((mark / maxMark) * 100, 0);
}

/**
 * Summary statistics for an assessment. `marks` must contain only the
 * marks that have actually been entered — an unmarked learner has no row
 * in assessment_results (see the migration) and must never be passed in
 * as a 0 or a placeholder, or the average would be silently wrong.
 * `totalLearnerCount` is the full class roster size, used only to derive
 * markedCount/unmarkedCount — it never enters the average itself.
 */
export function calculateMarkStats(marks: number[], maxMark: number, totalLearnerCount: number): MarkStats {
  const markedCount = marks.length;
  const unmarkedCount = Math.max(0, totalLearnerCount - markedCount);

  if (markedCount === 0) {
    return {
      totalCount: totalLearnerCount,
      markedCount,
      unmarkedCount,
      averageMark: null,
      averagePercentage: null,
      highestMark: null,
      lowestMark: null,
    };
  }

  const sum = marks.reduce((total, mark) => total + mark, 0);
  const averageMark = sum / markedCount;
  const averagePercentage = maxMark > 0 ? (averageMark / maxMark) * 100 : 0;

  return {
    totalCount: totalLearnerCount,
    markedCount,
    unmarkedCount,
    averageMark: round(averageMark, 1),
    averagePercentage: round(averagePercentage, 1),
    highestMark: Math.max(...marks),
    lowestMark: Math.min(...marks),
  };
}

/** Whether a mark is a valid entry for the given assessment — mirrors the database's own CHECK/trigger constraints, so the UI can reject before ever attempting to save. */
export function isValidMark(mark: number, maxMark: number): boolean {
  return Number.isInteger(mark) && mark >= 0 && mark <= maxMark;
}
