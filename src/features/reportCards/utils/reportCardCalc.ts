/**
 * Client-side mirror of the SQL report-card aggregation
 * (recalc_report_card_internal in 20260904100000_report_cards.sql). The
 * database is the source of truth for a persisted report card; this module
 * exists for the "staff preview" (what a card *would* look like before you
 * generate it) and so the calculation is unit-testable in isolation.
 *
 * Rounding matches the SQL: a subject/overall average rounds to two
 * decimal places (numeric(5,2)); the achievement band is resolved on the
 * value rounded to a whole number (round(p_percentage) in resolve_achievement).
 */

import type { GradingScaleBand } from '@/features/reportCards/types/reportCard.types';

export interface WeightedMark {
  /** mark / maxMark, already a fraction 0..1 is NOT expected — pass the raw mark and maxMark. */
  mark: number;
  maxMark: number;
  /** assessment weight (assessments.weight); defaults to 1. */
  weight?: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The assessment.weight-weighted mean of (mark / maxMark * 100) across a
 * learner's marks for one subject. Returns null when there are no marks
 * (matching the SQL, where average_percentage stays NULL) — never 0.
 */
export function subjectAveragePercentage(marks: WeightedMark[]): number | null {
  const usable = marks.filter((m) => m.maxMark > 0);
  if (usable.length === 0) return null;
  let num = 0;
  let den = 0;
  for (const m of usable) {
    const w = m.weight ?? 1;
    num += (m.mark / m.maxMark) * 100 * w;
    den += w;
  }
  if (den === 0) return null;
  return round2(num / den);
}

export interface SubjectAverageInput {
  averagePercentage: number | null;
  /** report_card_subjects.weight — this subject's contribution to the overall. */
  weight?: number;
}

/**
 * The subject-weight-weighted mean of subject averages. Subjects with a
 * null average (no marks) are excluded, not treated as 0 — matching the
 * SQL, which only adds a subject to the overall numerator/denominator when
 * its average is non-null.
 */
export function overallAveragePercentage(subjects: SubjectAverageInput[]): number | null {
  let num = 0;
  let den = 0;
  for (const s of subjects) {
    if (s.averagePercentage === null) continue;
    const w = s.weight ?? 1;
    num += round2(s.averagePercentage) * w;
    den += w;
  }
  if (den === 0) return null;
  return round2(num / den);
}

/**
 * The band a percentage falls into, or null if the scale has no matching
 * band / the percentage is null. Mirrors resolve_achievement(): compares
 * on Math.round(percentage) and, if bands overlapped (they cannot, per the
 * DB non-overlap trigger), prefers the higher lower-bound.
 */
export function resolveBand(bands: GradingScaleBand[], percentage: number | null): GradingScaleBand | null {
  if (percentage === null) return null;
  const p = Math.round(percentage);
  const matches = bands
    .filter((b) => p >= b.minPercentage && p <= b.maxPercentage)
    .sort((a, b) => b.minPercentage - a.minPercentage);
  return matches[0] ?? null;
}

/** present + late count towards "attended"; the rate excludes excused days from the denominator, matching attendance/utils/calculations.ts. */
export function attendanceRate(present: number, late: number, absent: number): number | null {
  const qualifying = present + late + absent;
  if (qualifying === 0) return null;
  return Math.round(((present + late) / qualifying) * 100);
}
