import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { FullScreenNotice } from '@/components/ui/FullScreenNotice';
import { Tabs } from '@/components/ui/Tabs';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useLearner } from '@/features/learners/hooks/useLearner';
import { LearnerFormModal } from '@/features/learners/components/LearnerFormModal';
import { LearnerLoginModal } from '@/features/learners/components/LearnerLoginModal';
import { ChangeLearnerStatusDialog } from '@/features/learners/components/ChangeLearnerStatusDialog';
import { LearnerOverviewSection } from '@/features/learners/components/LearnerOverviewSection';
import { LearnerOverviewDashboard } from '@/features/learners/components/LearnerOverviewDashboard';
import { LearnerEnrollmentSection } from '@/features/learners/components/LearnerEnrollmentSection';
import { LearnerGuardiansSection } from '@/features/learners/components/LearnerGuardiansSection';
import { LearnerEmergencyContactsSection } from '@/features/learners/components/LearnerEmergencyContactsSection';
import { LearnerMedicalSection } from '@/features/learners/components/LearnerMedicalSection';
import { LearnerDocumentsSection } from '@/features/learners/components/LearnerDocumentsSection';
import { LearnerTransfersSection } from '@/features/learners/components/LearnerTransfersSection';
import { LearnerReportCardsSection } from '@/features/reportCards/components/LearnerReportCardsSection';
import { LearnerInterventionsSection } from '@/features/learners/components/LearnerInterventionsSection';
import { LearnerSafeguardingSection } from '@/features/safeguarding/components/LearnerSafeguardingSection';
import { LearnerConsentSection } from '@/features/consent/components/LearnerConsentSection';
import { LearnerAssessmentResultsSection } from '@/features/assessments/components/LearnerAssessmentResultsSection';
import { LearnerFinancialSection } from '@/features/fees/components/LearnerFinancialSection';
import { LearnerBehaviourSection } from '@/features/behaviour/components/LearnerBehaviourSection';
import { BehaviourIncidentFormModal } from '@/features/behaviour/components/BehaviourIncidentFormModal';
import { RecordPaymentFormModal } from '@/features/fees/components/RecordPaymentFormModal';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useEnrollments } from '@/features/learners/hooks/useEnrollments';
import { useGuardians } from '@/features/learners/hooks/useGuardians';
import { useEmergencyContacts } from '@/features/learners/hooks/useEmergencyContacts';
import { useMedicalInformation } from '@/features/learners/hooks/useMedicalInformation';
import { useLearnerResults } from '@/features/assessments/hooks/useLearnerResults';
import { useLearnerAttendanceSummary } from '@/features/attendance/hooks/useLearnerAttendanceSummary';
import { useLearnerFees } from '@/features/fees/hooks/useLearnerFees';
import { useLearnerBehaviour } from '@/features/behaviour/hooks/useLearnerBehaviour';
import { useTeachingAssignments } from '@/features/teaching/hooks/useTeachingAssignments';
import { guardianService } from '@/features/learners/services/guardianService';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import { toPercentage } from '@/features/assessments/utils/calculations';
import { buildLearnerTimeline } from '@/features/learners/utils/learnerTimeline';
import { deriveLearnerAlerts } from '@/features/learners/utils/learnerAlerts';

type TabKey =
  | 'overview'
  | 'enrollment'
  | 'guardians'
  | 'emergency'
  | 'financial'
  | 'behaviour'
  | 'medical'
  | 'documents'
  | 'transfers'
  | 'results'
  | 'reportCards'
  | 'interventions'
  | 'safeguarding'
  | 'consent';

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function LearnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('learner.manage');
  const canViewSensitive = can('learner.view_sensitive');
  const canViewMedical = can('learner.view_medical');
  const canManageMedical = can('learner.manage_medical');
  const canViewResults = can('assessment.view');
  const canViewReportCards = can('reportcard.view');
  const canViewFinancial = can('learner.view_financial');
  const canManageFinancial = can('learner.manage_financial');
  const canViewBehaviour = can('learner.view_behaviour');
  const canManageBehaviour = can('learner.manage_behaviour');
  // Academic interventions reuse assessment.view/manage verbatim — an
  // intervention is conceptually adjacent to assessment results, not a new
  // permission (mirrors can_view_academic_intervention()'s own RLS reasoning).
  const canManageIntervention = can('assessment.manage');
  const canViewSafeguarding = can('learner.view_safeguarding');

  const { school } = useSchool();
  const { learner, isLoading, error, refetch } = useLearner(id);
  const { academicYears, currentAcademicYear } = useAcademic();
  const { subjects } = useSubjects(school?.id);
  const { terms } = useTerms(academicYears.find((year) => year.isActive)?.id);
  const { grades } = useGrades(school?.id);
  const { classes } = useClasses(school?.id);
  const { enrollments } = useEnrollments(id);
  const { assignments } = useTeachingAssignments(school?.id);

  const { guardians, isLoading: guardiansLoading, error: guardiansError } = useGuardians(id);
  const { emergencyContacts } = useEmergencyContacts(id);
  const {
    medicalInformation,
    isLoading: medicalLoading,
    error: medicalError,
  } = useMedicalInformation(canViewMedical ? id : undefined);
  const { results, isLoading: resultsLoading, error: resultsError } = useLearnerResults(id);
  const {
    stats: attendanceStats,
    recentRecords: recentAttendance,
    isLoading: attendanceLoading,
    error: attendanceError,
  } = useLearnerAttendanceSummary(id);
  const {
    summary: feeSummary,
    isLoading: feeLoading,
    error: feeError,
    refetch: refetchFees,
  } = useLearnerFees(canViewFinancial ? id : undefined);
  const {
    summary: behaviourSummary,
    isLoading: behaviourLoading,
    error: behaviourError,
    refetch: refetchBehaviour,
  } = useLearnerBehaviour(canViewBehaviour ? id : undefined);

  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const termsById = useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const academicYearsById = useMemo(() => Object.fromEntries(academicYears.map((y) => [y.id, y])), [academicYears]);
  const gradeNamesById = useMemo(() => Object.fromEntries(grades.map((g) => [g.id, g.name])), [grades]);
  const classNamesById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);
  const academicYearNamesById = useMemo(() => Object.fromEntries(academicYears.map((y) => [y.id, y.name])), [academicYears]);

  const currentEnrollment = enrollments.find(
    (e) => e.academicYearId === currentAcademicYear?.id && e.enrollmentStatus === 'enrolled',
  );
  const currentGrade = currentEnrollment ? grades.find((g) => g.id === currentEnrollment.gradeId) : undefined;
  const currentClass = currentEnrollment?.classId ? classes.find((c) => c.id === currentEnrollment.classId) : undefined;

  // Class teacher lookup: the assignment with subject_id null is the "whole
  // class" teacher, per class_teacher_assignments' own documented shape.
  const [classTeacherName, setClassTeacherName] = useState<string | null>(null);
  useEffect(() => {
    const assignment = assignments.find(
      (a) => a.classId === currentClass?.id && a.academicYearId === currentAcademicYear?.id && !a.subjectId && a.active,
    );
    if (!assignment) {
      setClassTeacherName(null);
      return;
    }
    let isMounted = true;
    void teachingAssignmentService.getTeacherCandidatesByIds([assignment.teacherProfileId]).then((results) => {
      if (isMounted && results[0]) setClassTeacherName(`${results[0].firstName} ${results[0].lastName}`);
    });
    return () => {
      isMounted = false;
    };
  }, [assignments, currentClass?.id, currentAcademicYear?.id]);

  const guardianProfileIds = useMemo(() => guardians.map((g) => g.guardianProfileId), [guardians]);
  const [guardianCandidatesById, setGuardianCandidatesById] = useState<Record<string, GuardianCandidate>>({});
  useEffect(() => {
    const missingIds = guardianProfileIds.filter((profileId) => !guardianCandidatesById[profileId]);
    if (missingIds.length === 0) return;
    void guardianService.getGuardianCandidatesByIds(missingIds).then((candidates) => {
      setGuardianCandidatesById((prev) => {
        const next = { ...prev };
        for (const candidate of candidates) next[candidate.id] = candidate;
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardianProfileIds]);

  const guardianNamesById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(guardianCandidatesById).map(([id, candidate]) => [id, `${candidate.firstName} ${candidate.lastName}`]),
      ),
    [guardianCandidatesById],
  );

  const overallAveragePercentage = useMemo(() => {
    if (results.length === 0) return null;
    const percentages = results.map((r) => toPercentage(r.mark, r.maxMark));
    return Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
  }, [results]);

  const timelineEvents = useMemo(
    () =>
      buildLearnerTimeline({
        results,
        subjectsById,
        recentAttendance,
        guardians,
        guardianNamesById,
        feePayments: canViewFinancial ? (feeSummary?.payments ?? []) : undefined,
        behaviourIncidents: canViewBehaviour ? (behaviourSummary?.incidents ?? []) : undefined,
        enrollments,
        academicYearNamesById,
        gradeNamesById,
        classNamesById,
      }),
    [
      results,
      subjectsById,
      recentAttendance,
      guardians,
      guardianNamesById,
      canViewFinancial,
      feeSummary,
      canViewBehaviour,
      behaviourSummary,
      enrollments,
      academicYearNamesById,
      gradeNamesById,
      classNamesById,
    ],
  );

  const alerts = useMemo(
    () =>
      deriveLearnerAlerts({
        guardianCount: guardians.filter((g) => g.active).length,
        hasEmergencyContact: emergencyContacts.length > 0,
        attendanceStats,
        overallAveragePercentage,
        feeSummary: canViewFinancial ? feeSummary : undefined,
        behaviourSummary: canViewBehaviour ? behaviourSummary : undefined,
        hasMedicalInfoOnFile: canViewMedical ? medicalInformation !== null : undefined,
      }),
    [
      guardians,
      emergencyContacts,
      attendanceStats,
      overallAveragePercentage,
      canViewFinancial,
      feeSummary,
      canViewBehaviour,
      behaviourSummary,
      canViewMedical,
      medicalInformation,
    ],
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'enrollment', label: 'Enrollment' },
    { key: 'guardians', label: 'Guardians' },
    { key: 'emergency', label: 'Emergency contacts' },
    { key: 'consent', label: 'Consent' },
    ...(canViewFinancial ? [{ key: 'financial' as const, label: 'Financial' }] : []),
    ...(canViewBehaviour ? [{ key: 'behaviour' as const, label: 'Behaviour' }] : []),
    { key: 'medical', label: 'Medical' },
    { key: 'documents', label: 'Documents' },
    { key: 'transfers', label: 'Transfers' },
    ...(canViewResults ? [{ key: 'results' as const, label: 'Academic results' }] : []),
    ...(canViewReportCards ? [{ key: 'reportCards' as const, label: 'Report cards' }] : []),
    ...(canViewResults ? [{ key: 'interventions' as const, label: 'Interventions' }] : []),
    ...(canViewSafeguarding ? [{ key: 'safeguarding' as const, label: 'Safeguarding' }] : []),
  ];

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  const [isLearnerLoginOpen, setIsLearnerLoginOpen] = useState(false);

  if (isLoading) {
    return <FullScreenSpinner label="Loading learner…" />;
  }

  if (error) {
    return <FullScreenNotice title="Something went wrong" message={error} />;
  }

  if (!learner || !school) {
    return (
      <FullScreenNotice
        title="Learner not found"
        message="This learner doesn't exist, or you don't have access to view them."
        action={
          <Link to="/learners" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline">
            Back to Learners
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/learners')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to Learners
      </button>

      <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
              {learner.firstName[0]}
              {learner.lastName[0]}
            </span>
            <div>
              <h1 className="text-xl font-bold text-content-primary">
                {learner.firstName} {learner.lastName}
                {learner.preferredName && (
                  <span className="ml-2 text-base font-normal text-content-tertiary">"{learner.preferredName}"</span>
                )}
              </h1>
              <p className="text-sm text-content-secondary">
                {learner.learnerNumber} · {learner.admissionNumber}
              </p>
              <p className="mt-0.5 text-sm text-content-tertiary">
                {currentGrade ? currentGrade.name : 'Grade —'}
                {currentClass ? ` · ${currentClass.name}` : ''}
                {currentAcademicYear ? ` · ${currentAcademicYear.name}` : ''}
              </p>
              <p className="mt-0.5 text-xs text-content-tertiary">
                {calculateAge(learner.dateOfBirth)} years old · Admitted {learner.admissionDate}
                {classTeacherName ? ` · Class teacher: ${classTeacherName}` : ''}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            {learner.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
          {canManage && (
            <>
              <div className="w-full sm:w-auto sm:min-w-[8rem]">
                <Button type="button" variant="secondary" onClick={() => setIsEditOpen(true)}>
                  Edit details
                </Button>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[8rem]">
                <Button type="button" variant="secondary" onClick={() => setIsStatusOpen(true)}>
                  Change status
                </Button>
              </div>
              {!learner.profileId && (
                <div className="w-full sm:w-auto sm:min-w-[8rem]">
                  <Button type="button" variant="secondary" onClick={() => setIsLearnerLoginOpen(true)}>
                    Provision login
                  </Button>
                </div>
              )}
            </>
          )}
          {canManageFinancial && (
            <div className="w-full sm:w-auto sm:min-w-[8rem]">
              <Button type="button" variant="secondary" onClick={() => setIsPaymentOpen(true)}>
                Record payment
              </Button>
            </div>
          )}
          {canManageBehaviour && (
            <div className="w-full sm:w-auto sm:min-w-[8rem]">
              <Button type="button" variant="secondary" onClick={() => setIsIncidentOpen(true)}>
                Record behaviour
              </Button>
            </div>
          )}
        </div>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <>
          <LearnerOverviewDashboard
            learner={learner}
            alerts={alerts}
            guardians={guardians}
            guardianCandidatesById={guardianCandidatesById}
            guardiansLoading={guardiansLoading}
            guardiansError={guardiansError}
            onViewGuardians={() => setActiveTab('guardians')}
            results={results}
            subjectsById={subjectsById}
            resultsLoading={resultsLoading}
            resultsError={resultsError}
            onViewResults={() => setActiveTab(canViewResults ? 'results' : 'overview')}
            attendanceStats={attendanceStats}
            attendanceLoading={attendanceLoading}
            attendanceError={attendanceError}
            canViewFinancial={canViewFinancial}
            feeSummary={feeSummary}
            feeLoading={feeLoading}
            feeError={feeError}
            onViewFinancial={() => setActiveTab('financial')}
            canViewBehaviour={canViewBehaviour}
            behaviourSummary={behaviourSummary}
            behaviourLoading={behaviourLoading}
            behaviourError={behaviourError}
            onViewBehaviour={() => setActiveTab('behaviour')}
            canViewMedical={canViewMedical}
            medicalInformation={medicalInformation}
            medicalLoading={medicalLoading}
            medicalError={medicalError}
            onViewMedical={() => setActiveTab('medical')}
            enrollments={enrollments}
            academicYears={academicYears}
            grades={grades}
            classes={classes}
            onViewEnrollment={() => setActiveTab('enrollment')}
            timelineEvents={timelineEvents}
          />
          <LearnerOverviewSection learner={learner} canViewSensitive={canViewSensitive} />
        </>
      )}
      {activeTab === 'enrollment' && <LearnerEnrollmentSection learnerId={learner.id} canManage={canManage} />}
      {activeTab === 'guardians' && (
        <LearnerGuardiansSection schoolId={school.id} learnerId={learner.id} canManage={canManage} />
      )}
      {activeTab === 'emergency' && (
        <LearnerEmergencyContactsSection schoolId={school.id} learnerId={learner.id} canManage={canManage} />
      )}
      {activeTab === 'financial' && canViewFinancial && (
        <LearnerFinancialSection
          schoolId={school.id}
          learnerId={learner.id}
          learnerName={`${learner.firstName} ${learner.lastName}`}
          school={{
            name: school.name,
            address: school.physicalAddress,
            email: school.email,
            phone: school.phone,
            vatNumber: school.vatNumber,
            bankingDetails: school.bankingDetails,
            footerNote: school.invoiceFooterNote,
          }}
          academicYearId={currentAcademicYear?.id}
          canManage={canManageFinancial}
        />
      )}
      {activeTab === 'behaviour' && canViewBehaviour && (
        <LearnerBehaviourSection
          schoolId={school.id}
          learnerId={learner.id}
          academicYearId={currentAcademicYear?.id}
          canManage={canManageBehaviour}
        />
      )}
      {activeTab === 'medical' && (
        <LearnerMedicalSection
          schoolId={school.id}
          learnerId={learner.id}
          canView={canViewMedical}
          canManage={canManageMedical}
        />
      )}
      {activeTab === 'documents' && (
        <LearnerDocumentsSection schoolId={school.id} learnerId={learner.id} canManage={canManage} />
      )}
      {activeTab === 'transfers' && (
        <LearnerTransfersSection
          schoolId={school.id}
          learner={learner}
          canManage={canManage}
          letterContext={{
            schoolName: school.name,
            schoolAddress: school.physicalAddress,
            learnerNumber: learner.learnerNumber,
            admissionNumber: learner.admissionNumber,
            gradeName: currentGrade?.name,
          }}
        />
      )}
      {activeTab === 'results' && canViewResults && (
        <LearnerAssessmentResultsSection
          learnerId={learner.id}
          subjectsById={subjectsById}
          termsById={termsById}
          academicYearsById={academicYearsById}
          reportCard={
            school
              ? {
                  schoolName: school.name,
                  schoolAddress: school.physicalAddress,
                  learnerName: `${learner.firstName} ${learner.lastName}`,
                  learnerNumber: learner.learnerNumber,
                  gradeName: currentGrade?.name,
                  className: currentClass?.name,
                }
              : undefined
          }
        />
      )}
      {activeTab === 'reportCards' && canViewReportCards && (
        <LearnerReportCardsSection
          learnerId={learner.id}
          variant="staff"
          schoolName={school.name}
          schoolAddress={school.physicalAddress}
          gradeName={currentGrade?.name}
          className={currentClass?.name}
        />
      )}
      {activeTab === 'interventions' && canViewResults && (
        <LearnerInterventionsSection
          schoolId={school.id}
          learnerId={learner.id}
          academicYearId={currentAcademicYear?.id}
          subjects={subjects}
          subjectsById={subjectsById}
          canManage={canManageIntervention}
        />
      )}
      {activeTab === 'consent' && <LearnerConsentSection schoolId={school.id} learnerId={learner.id} canManage={canManage} />}
      {activeTab === 'safeguarding' && canViewSafeguarding && (
        <LearnerSafeguardingSection schoolId={school.id} learnerId={learner.id} />
      )}

      <LearnerFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        schoolId={school.id}
        learner={learner}
        onSaved={() => void refetch()}
      />
      <ChangeLearnerStatusDialog
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        learner={learner}
        onChanged={() => void refetch()}
      />
      {canManageFinancial && currentAcademicYear && (
        <RecordPaymentFormModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          schoolId={school.id}
          learnerId={learner.id}
          academicYearId={currentAcademicYear.id}
          onSaved={() => void refetchFees()}
        />
      )}
      {canManageBehaviour && currentAcademicYear && (
        <BehaviourIncidentFormModal
          isOpen={isIncidentOpen}
          onClose={() => setIsIncidentOpen(false)}
          schoolId={school.id}
          learnerId={learner.id}
          academicYearId={currentAcademicYear.id}
          onSaved={() => void refetchBehaviour()}
        />
      )}
      {isLearnerLoginOpen && (
        <LearnerLoginModal
          learnerId={learner.id}
          learnerFirstName={learner.firstName}
          onClose={() => setIsLearnerLoginOpen(false)}
          onProvisioned={() => void refetch()}
        />
      )}
    </div>
  );
}
