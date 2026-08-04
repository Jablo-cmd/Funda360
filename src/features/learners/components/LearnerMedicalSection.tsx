import { useMedicalInformation } from '@/features/learners/hooks/useMedicalInformation';
import { MedicalInformationCard } from '@/features/learners/components/MedicalInformationCard';

export interface LearnerMedicalSectionProps {
  schoolId: string;
  learnerId: string;
  canView: boolean;
  canManage: boolean;
}

export function LearnerMedicalSection({ schoolId, learnerId, canView, canManage }: LearnerMedicalSectionProps) {
  const { medicalInformation, isLoading, error, refetch } = useMedicalInformation(canView ? learnerId : undefined);

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        You don't have permission to view medical information for this learner.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}
      <MedicalInformationCard
        schoolId={schoolId}
        learnerId={learnerId}
        medicalInformation={medicalInformation}
        canView={canView}
        canManage={canManage}
        onSaved={() => void refetch()}
      />
    </div>
  );
}
