export type TimelineEventCategory = 'academic' | 'attendance' | 'guardian' | 'financial' | 'behaviour' | 'enrolment';

export interface TimelineEvent {
  id: string;
  /** ISO date or datetime — whichever the source row stores. */
  date: string;
  category: TimelineEventCategory;
  label: string;
}
