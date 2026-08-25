import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { guardianInvitationService } from '@/features/guardians/services/guardianInvitationService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { GuardianInvitation } from '@/features/guardians/types/guardian.types';

export interface RevokeInvitationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invitation: GuardianInvitation | null;
  guardianName: string;
  onRevoked: (invitation: GuardianInvitation) => void;
}

export function RevokeInvitationDialog({ isOpen, onClose, invitation, guardianName, onRevoked }: RevokeInvitationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!invitation) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const updated = await guardianInvitationService.revokeInvitation(invitation.id);
      onRevoked(updated);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to revoke invitation.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Revoke invitation"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-32">
            <Button type="button" onClick={() => void handleConfirm()} isLoading={isSubmitting}>
              {isSubmitting ? 'Revoking…' : 'Revoke'}
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
          The activation link already sent to <span className="font-medium text-content-primary">{guardianName}</span> will
          stop working immediately. You can send a new invitation at any time.
        </p>
      </div>
    </Modal>
  );
}
