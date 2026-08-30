import { z } from 'zod';
import type { DayOfWeek } from '@/features/timetable/types/timetable.types';

const DAY_INDEX_TO_NAME: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parameterized by the covered lesson's own day_of_week — a substitute
 * date must actually fall on that weekday, mirroring
 * timetable_substitutions_validate_tenant()'s own server-side check
 * exactly, so a mismatched date is caught with a friendly inline message
 * instead of a raw DB error round-trip.
 */
export function buildSubstitutionSchema(expectedDayOfWeek: DayOfWeek) {
  return z.object({
    substituteDate: z.string().trim().min(1, 'Date is required').refine(
      (value) => DAY_INDEX_TO_NAME[new Date(`${value}T00:00:00`).getDay()] === expectedDayOfWeek,
      { message: `This lesson runs on ${expectedDayOfWeek}s — pick a matching date` },
    ),
    substituteTeacherProfileId: z.string().trim().min(1, 'Select a substitute teacher'),
    reason: z.string().trim().optional(),
  });
}

export type SubstitutionFormValues = z.infer<ReturnType<typeof buildSubstitutionSchema>>;

export const substitutionDefaultValues: SubstitutionFormValues = {
  substituteDate: '',
  substituteTeacherProfileId: '',
  reason: '',
};
