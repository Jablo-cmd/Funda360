import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { FullScreenNotice } from '@/components/ui/FullScreenNotice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useLearner } from '@/features/learners/hooks/useLearner';
import { LearnerFormModal } from '@/features/learners/components/LearnerFormModal';
import { ChangeLearnerStatusDialog } from '@/features/learners/components/ChangeLearnerStatusDialog';
import { LearnerOverviewSection } from '@/features/learners/components/LearnerOverviewSection';
import { LearnerEnrollmentSection } from '@/features/learners/components/LearnerEnrollmentSection';
import { LearnerGuardiansSection } from '@/features/learners/components/LearnerGuardiansSection';
import { LearnerEmergencyContactsSection } from '@/features/learners/components/LearnerEmergencyContactsSection';
import { LearnerMedicalSection } from '@/features/learners/components/LearnerMedicalSection';
import { LearnerDocumentsSection } from '@/features/learners/components/LearnerDocumentsSection';
import { LearnerAssessmentResultsSection } from '@/features/assessments/components/LearnerAssessmentResultsSection';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useTerms } from '@/features/academic/hooks/useTerms';

type TabKey = 'overview' | 'enrollment' | 'guardians' | 'emergency' | 'medical' | 'documents' | 'results';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'enrollment', label: 'Enrollment' },
  { key: 'guardians', label: 'Guardians' },
  { key: 'emergency', label: 'Emergency contacts' },
  { key: 'medical', label: 'Medical' },
  { key: 'documents', label: 'Documents' },
  { key: 'results', label: 'Academic results' },
];

export function LearnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('learner.manage');
  const canViewSensitive = can('learner.view_sensitive');
  const canViewMedical = can('learner.view_medical');
  const canManageMedical = can('learner.manage_medical');
  const canViewResults = can('assessment.view');
  const { school } = useSchool();
  const { learner, isLoading, error, refetch } = useLearner(id);
  const { academicYears } = useAcademic();
  const { subjects } = useSubjects(school?.id);
  const { terms } = useTerms(academicYears.find((year) => year.isActive)?.id);

  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const termsById = useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const academicYearsById = useMemo(() => Object.fromEntries(academicYears.map((y) => [y.id, y])), [academicYears]);

  const visibleTabs = TABS.filter((tab) => tab.key !== 'results' || canViewResults);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
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
              </h1>
              <p className="text-sm text-content-secondary">
                {learner.learnerNumber} · {learner.admissionNumber}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            {learner.status.replace(/_/g, ' ')}
          </span>
        </div>

        {canManage && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
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
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`focus-ring rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-300'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <LearnerOverviewSection learner={learner} canViewSensitive={canViewSensitive} />
      )}
      {activeTab === 'enrollment' && <LearnerEnrollmentSection learnerId={learner.id} canManage={canManage} />}
      {activeTab === 'guardians' && (
        <LearnerGuardiansSection schoolId={school.id} learnerId={learner.id} canManage={canManage} />
      )}
      {activeTab === 'emergency' && (
        <LearnerEmergencyContactsSection schoolId={school.id} learnerId={learner.id} canManage={canManage} />
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
      {activeTab === 'results' && canViewResults && (
        <LearnerAssessmentResultsSection
          learnerId={learner.id}
          subjectsById={subjectsById}
          termsById={termsById}
          academicYearsById={academicYearsById}
        />
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
    </div>
  );
}
