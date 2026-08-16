import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { guardianService } from '@/features/learners/services/guardianService';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { LearnerGuardian } from '@/features/learners/types/learner.types';

export interface RemoveGuardianDialogProps {
  isOpen: boolean;
  onClose: () => void;
  guardian: LearnerGuardian;
  candidate: GuardianCandidate | undefined;
  onRemoved: (guardian: LearnerGuardian) => void;
}

export function RemoveGuardianDialog({ isOpen, onClose, guardian, candidate, onRemoved }: RemoveGuardianDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const updated = await guardianService.archiveGuardian(guardian.id);
      onRemoved(updated);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to remove guardian.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const name = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'This guardian';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove guardian"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-32">
            <Button type="button" onClick={() => void handleConfirm()} isLoading={isSubmitting}>
              {isSubmitting ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}
        <p className="text-sm text-content-secondary">
          <span className="font-medium text-content-primary">{name}</span> will lose access to this learner's
          record, medical information and emergency contacts immediately. This does not delete their account and
          can be undone from this list at any time.
        </p>
      </div>
    </Modal>
  );
}
