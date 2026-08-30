import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { interventionService } from '@/features/learners/services/interventionService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { AcademicIntervention, AcademicInterventionStatus } from '@/features/learners/types/intervention.types';

export interface UpdateInterventionStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  intervention: AcademicIntervention;
  onChanged: () => void;
}

const STATUS_OPTIONS: { value: AcademicInterventionStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

export function UpdateInterventionStatusDialog({ isOpen, onClose, intervention, onChanged }: UpdateInterventionStatusDialogProps) {
  const [status, setStatus] = useState<AcademicInterventionStatus>(intervention.status);
  const [resolutionNotes, setResolutionNotes] = useState(intervention.resolutionNotes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await interventionService.updateStatus(intervention.id, { status, resolutionNotes: resolutionNotes.trim() || null });
      onChanged();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to update status.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update intervention status"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-32">
            <Button type="button" onClick={() => void handleConfirm()} isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Update'}
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

        <p className="text-sm text-content-secondary">{intervention.title}</p>

        <div>
          <label htmlFor="intervention-status" className="mb-1.5 block text-sm font-medium text-content-primary">
            Status
          </label>
          <select
            id="intervention-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as AcademicInterventionStatus)}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <TextField
          label="Resolution notes"
          value={resolutionNotes}
          onChange={(event) => setResolutionNotes(event.target.value)}
        />
      </div>
    </Modal>
  );
}
