export interface TimetableSubstitution {
  id: string;
  schoolId: string;
  timetableEntryId: string;
  substituteDate: string;
  substituteTeacherProfileId: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateTimetableSubstitutionInput {
  timetableEntryId: string;
  substituteDate: string;
  substituteTeacherProfileId: string;
  reason?: string | null;
  notes?: string | null;
}
