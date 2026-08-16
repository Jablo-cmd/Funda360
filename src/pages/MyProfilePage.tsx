import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { FullScreenNotice } from '@/components/ui/FullScreenNotice';
import { useMyEmployee } from '@/features/employees/hooks/useMyEmployee';
import { EmployeeSelfSummary } from '@/features/employees/components/EmployeeSelfSummary';
import { useMyLearners } from '@/features/learners/hooks/useMyLearners';
import { LearnerSelfSummary } from '@/features/learners/components/LearnerSelfSummary';
import { useMyTeachingAssignments } from '@/features/teaching/hooks/useMyTeachingAssignments';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { MyClassesSummary } from '@/features/teaching/components/MyClassesSummary';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Composition page only — layout, rendering order, and conditional
 * visibility. All data access, mapping, and authorization live in the
 * Employees, Learners and Teaching domains this page composes; RLS (not
 * this page) decides which rows, if any, come back from each hook.
 */
export function MyProfilePage() {
  const { can } = usePermissions();
  const employee = useMyEmployee();
  const learners = useMyLearners();
  const myClasses = useMyTeachingAssignments();
  const { school } = useSchool();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { academicYears } = useAcademic();

  if (employee.isLoading || learners.isLoading || myClasses.isLoading) {
    return <FullScreenSpinner label="Loading your profile…" />;
  }

  const hasEmployeeRecord = Boolean(employee.data);
  // useMyLearners() issues an unfiltered `select * from learners` and
  // relies entirely on RLS (learners_select's is_learner_guardian() OR
  // clause) to scope it to "children I'm a guardian of" — the only way to
  // scope it that also works for guardians, who can't query
  // learner_guardians directly to discover their own links (no self-select
  // policy on that table; see 20260803190000_learner_management.sql). For
  // any role RLS also grants can_view_learners() to, the same unfiltered
  // query returns the school's entire roster, which "My Children" would
  // mislabel as this user's own children. Every role that gets
  // can_view_learners() at the RLS layer also holds `learner.view` in the
  // TS permission model (they were designed in sync), and those roles
  // already have the real Learners directory for this purpose — so gating
  // on the absence of `learner.view` distinguishes "genuine guardian" from
  // "staff who happen to see everything" without touching RLS or the
  // query itself.
  const hasLearners = !can('learner.view') && learners.data.length > 0;
  const hasMyClasses = myClasses.data.length > 0;

  if (!hasEmployeeRecord && !hasLearners && !hasMyClasses) {
    return (
      <FullScreenNotice
        title="My Profile"
        message="There's nothing linked to your account yet."
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary">My Profile</h1>
        <p className="mt-1 text-sm text-content-secondary">Records linked to your account.</p>
      </div>

      {hasEmployeeRecord && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">Employee Information</h2>
          {employee.error ? (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
            >
              {employee.error}
            </div>
          ) : (
            employee.data && <EmployeeSelfSummary employee={employee.data} />
          )}
        </section>
      )}

      {hasLearners && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">My Children</h2>
          {learners.error ? (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
            >
              {learners.error}
            </div>
          ) : (
            learners.data.map((learner) => <LearnerSelfSummary key={learner.id} learner={learner} />)
          )}
        </section>
      )}

      {hasMyClasses && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">My Classes</h2>
          {myClasses.error ? (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
            >
              {myClasses.error}
            </div>
          ) : (
            myClasses.data.map((assignment) => (
              <MyClassesSummary
                key={assignment.id}
                assignment={assignment}
                cls={classes.find((cls) => cls.id === assignment.classId)}
                subject={subjects.find((subject) => subject.id === assignment.subjectId)}
                academicYear={academicYears.find((year) => year.id === assignment.academicYearId)}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}
