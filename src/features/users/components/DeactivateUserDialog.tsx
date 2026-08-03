import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { userService } from '@/features/users/services/userService';
import type { Profile } from '@/types/profile.types';

export interface DeactivateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  onDeactivated: () => void;
}

export function DeactivateUserDialog({ isOpen, onClose, user, onDeactivated }: DeactivateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await userService.deactivateUser(user.id);
      onDeactivated();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to deactivate user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deactivate user"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-40">
            <Button type="button" onClick={() => void handleConfirm()} isLoading={isSubmitting}>
              {isSubmitting ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}
        <p className="text-sm text-content-secondary">
          <span className="font-medium text-content-primary">
            {user.firstName} {user.lastName}
          </span>{' '}
          will no longer be able to sign in until reactivated. This does not delete their account.
        </p>
      </div>
    </Modal>
  );
}