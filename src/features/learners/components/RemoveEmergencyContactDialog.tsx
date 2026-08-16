import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { emergencyContactService } from '@/features/learners/services/emergencyContactService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { LearnerEmergencyContact } from '@/features/learners/types/learner.types';

export interface RemoveEmergencyContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contact: LearnerEmergencyContact;
  onRemoved: (contact: LearnerEmergencyContact) => void;
}

export function RemoveEmergencyContactDialog({ isOpen, onClose, contact, onRemoved }: RemoveEmergencyContactDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const updated = await emergencyContactService.archiveEmergencyContact(contact.id);
      onRemoved(updated);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to remove emergency contact.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove emergency contact"
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
          <span className="font-medium text-content-primary">{contact.name}</span> will be removed from this
          learner's emergency contacts. This can be undone from this list at any time.
        </p>
      </div>
    </Modal>
  );
}
