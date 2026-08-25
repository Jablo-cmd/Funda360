import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import type { LearnerMedicalInformation } from '@/features/learners/types/learner.types';

export interface MedicalAlertCardProps {
  medicalInformation: LearnerMedicalInformation | null;
  isLoading: boolean;
  error: string | null;
  onViewDetails: () => void;
}

/** Indicator only — allergies/conditions exist or not — never the actual sensitive content, which stays on the Medical tab behind its own separately-gated fetch. */
export function MedicalAlertCard({ medicalInformation, isLoading, error, onViewDetails }: MedicalAlertCardProps) {
  const hasAllergies = Boolean(medicalInformation?.allergies);
  const hasConditions = Boolean(medicalInformation?.medicalConditions);
  const flagged = hasAllergies || hasConditions;

  return (
    <Card
      title="Medical / Important Information"
      action={
        <button type="button" onClick={onViewDetails} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          View details
        </button>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Loading medical summary…" compact />
      ) : error ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : !medicalInformation ? (
        <p className="text-sm text-content-tertiary">No medical information on file.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              flagged ? 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500' : 'bg-success-500/15 text-success-500'
            }`}
          >
            {flagged ? 'Has allergies/conditions on file' : 'No flags on file'}
          </span>
          <p className="text-xs text-content-tertiary">Open the Medical tab for full details.</p>
        </div>
      )}
    </Card>
  );
}
