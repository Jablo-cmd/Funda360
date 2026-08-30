import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { safeguardingService } from '@/features/safeguarding/services/safeguardingService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { SafeguardingConcern, SafeguardingStatus } from '@/features/safeguarding/types/safeguarding.types';

export interface UpdateSafeguardingConcernDialogProps {
  isOpen: boolean;
  onClose: () => void;
  concern: SafeguardingConcern;
  onChanged: () => void;
}

const STATUS_OPTIONS: { value: SafeguardingStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function UpdateSafeguardingConcernDialog({ isOpen, onClose, concern, onChanged }: UpdateSafeguardingConcernDialogProps) {
  const [status, setStatus] = useState<SafeguardingStatus>(concern.status);
  const [actionTaken, setActionTaken] = useState(concern.actionTaken ?? '');
  const [confidentialNotes, setConfidentialNotes] = useState(concern.confidentialNotes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSave = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await safeguardingService.updateConcern(concern.id, {
        status,
        actionTaken: actionTaken.trim() || null,
        confidentialNotes: confidentialNotes.trim() || null,
      });
      onChanged();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to update this concern.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update safeguarding concern"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-28">
            <Button type="button" onClick={() => void handleSave()} isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <p className="text-sm text-content-secondary">{concern.description}</p>

        <div>
          <label htmlFor="safeguarding-status" className="mb-1.5 block text-sm font-medium text-content-primary">
            Status
          </label>
          <select
            id="safeguarding-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as SafeguardingStatus)}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <TextField label="Action taken" value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} />
        <TextField label="Confidential notes" value={confidentialNotes} onChange={(event) => setConfidentialNotes(event.target.value)} />
      </div>
    </Modal>
  );
}
