import { supabase } from '@/lib/supabase';
import type { DayOfWeek } from '@/lib/database.types';

export interface WorkspaceClass {
  classId: string;
  className: string;
  subjectId: string | null;
  subjectName: string | null;
}

export interface WorkspaceLesson {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  room: string | null;
}

export interface WorkspaceAttendanceStatus {
  classId: string;
  className: string;
  registerTaken: boolean;
}

export interface WorkspaceAssessment {
  id: string;
  title: string;
  className: string;
  subjectName: string;
  assessmentDate: string;
}

export interface WorkspaceHomework {
  id: string;
  title: string;
  className: string;
  dueAt: string | null;
  toMark: number;
}

export interface TeacherWorkspace {
  classes: WorkspaceClass[];
  todayLessons: WorkspaceLesson[];
  attendance: WorkspaceAttendanceStatus[];
  upcomingAssessments: WorkspaceAssessment[];
  homeworkToMark: WorkspaceHomework[];
}

const DAY_NAMES: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getWorkspace(
  userId: string,
  schoolId: string,
  academicYearId: string | undefined,
): Promise<TeacherWorkspace> {
  const today = todayIso();
  const dayName: DayOfWeek = DAY_NAMES[new Date().getDay()] ?? 'monday';

  const { data: assignmentRows, error: aErr } = await supabase
    .from('class_teacher_assignments')
    .select('class_id, subject_id, active, classes(name), subjects(name)')
    .eq('teacher_profile_id', userId)
    .eq('active', true);
  if (aErr) throw aErr;

  const classes: WorkspaceClass[] = (assignmentRows ?? []).map((r) => {
    const rr = r as unknown as {
      class_id: string;
      subject_id: string | null;
      classes: { name: string } | null;
      subjects: { name: string } | null;
    };
    return {
      classId: rr.class_id,
      className: rr.classes?.name ?? 'Class',
      subjectId: rr.subject_id,
      subjectName: rr.subjects?.name ?? null,
    };
  });
  const classIds = [...new Set(classes.map((c) => c.classId))];
  const classNameById = new Map(classes.map((c) => [c.classId, c.className]));

  const [lessonsRes, attendanceRes, assessmentsRes, homeworkRes] = await Promise.all([
    supabase
      .from('timetable_entries')
      .select('id, class_id, start_time, end_time, room, day_of_week, status, teacher_profile_id, classes(name), subjects(name)')
      .eq('teacher_profile_id', userId)
      .eq('day_of_week', dayName)
      .eq('status', 'published')
      .eq('active', true),
    classIds.length > 0
      ? supabase.from('attendance_records').select('class_id').in('class_id', classIds).eq('attendance_date', today)
      : Promise.resolve({ data: [], error: null }),
    classIds.length > 0
      ? supabase
          .from('assessments')
          .select('id, title, assessment_date, class_id, active, classes(name), subjects(name)')
          .in('class_id', classIds)
          .eq('active', true)
          .gte('assessment_date', today)
          .order('assessment_date', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('assignments')
      .select('id, title, due_at, status, class_id, classes(name)')
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(50),
  ]);
  if (lessonsRes.error) throw lessonsRes.error;
  if (attendanceRes.error) throw attendanceRes.error;
  if (assessmentsRes.error) throw assessmentsRes.error;
  if (homeworkRes.error) throw homeworkRes.error;

  const todayLessons: WorkspaceLesson[] = (lessonsRes.data ?? [])
    .map((r) => {
      const rr = r as unknown as {
        id: string;
        class_id: string;
        start_time: string;
        end_time: string;
        room: string | null;
        classes: { name: string } | null;
        subjects: { name: string } | null;
      };
      return {
        id: rr.id,
        classId: rr.class_id,
        className: rr.classes?.name ?? 'Class',
        subjectName: rr.subjects?.name ?? 'Subject',
        startTime: rr.start_time,
        endTime: rr.end_time,
        room: rr.room,
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const registerTakenFor = new Set((attendanceRes.data ?? []).map((r) => (r as { class_id: string }).class_id));
  const attendance: WorkspaceAttendanceStatus[] = classIds.map((classId) => ({
    classId,
    className: classNameById.get(classId) ?? 'Class',
    registerTaken: registerTakenFor.has(classId),
  }));

  const upcomingAssessments: WorkspaceAssessment[] = (assessmentsRes.data ?? []).map((r) => {
    const rr = r as unknown as {
      id: string;
      title: string;
      assessment_date: string;
      classes: { name: string } | null;
      subjects: { name: string } | null;
    };
    return {
      id: rr.id,
      title: rr.title,
      className: rr.classes?.name ?? 'Class',
      subjectName: rr.subjects?.name ?? 'Subject',
      assessmentDate: rr.assessment_date,
    };
  });

  // Homework awaiting marking: my published assignments (RLS already limits
  // `assignments` to ones I can view; narrow to my own classes) with a
  // count of submissions in submitted/late.
  const myAssignments = (homeworkRes.data ?? [])
    .map((r) => r as unknown as { id: string; title: string; due_at: string | null; class_id: string; classes: { name: string } | null })
    .filter((r) => classIds.length === 0 || classIds.includes(r.class_id));

  let homeworkToMark: WorkspaceHomework[] = [];
  if (myAssignments.length > 0) {
    const { data: subs, error: subErr } = await supabase
      .from('assignment_submissions')
      .select('assignment_id, status')
      .in('assignment_id', myAssignments.map((a) => a.id))
      .in('status', ['submitted', 'late']);
    if (subErr) throw subErr;
    const countByAssignment = new Map<string, number>();
    for (const s of subs ?? []) {
      const key = (s as { assignment_id: string }).assignment_id;
      countByAssignment.set(key, (countByAssignment.get(key) ?? 0) + 1);
    }
    homeworkToMark = myAssignments
      .map((a) => ({
        id: a.id,
        title: a.title,
        className: a.classes?.name ?? 'Class',
        dueAt: a.due_at,
        toMark: countByAssignment.get(a.id) ?? 0,
      }))
      .filter((h) => h.toMark > 0);
  }

  void academicYearId; // reserved for future year-scoped filtering

  return { classes, todayLessons, attendance, upcomingAssessments, homeworkToMark };
}

export const teacherWorkspaceService = { getWorkspace };
