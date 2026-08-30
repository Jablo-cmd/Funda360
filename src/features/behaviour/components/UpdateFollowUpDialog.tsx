import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { behaviourService } from '@/features/behaviour/services/behaviourService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { BehaviourIncident, BehaviourFollowUpStatus } from '@/features/behaviour/types/behaviour.types';

export interface UpdateFollowUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  incident: BehaviourIncident;
  onChanged: () => void;
}

const STATUS_OPTIONS: { value: BehaviourFollowUpStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

export function UpdateFollowUpDialog({ isOpen, onClose, incident, onChanged }: UpdateFollowUpDialogProps) {
  const [status, setStatus] = useState<BehaviourFollowUpStatus>(incident.followUpStatus);
  const [targetDate, setTargetDate] = useState(incident.followUpTargetDate ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSave = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await behaviourService.updateFollowUp(incident.id, {
        followUpStatus: status,
        followUpTargetDate: targetDate.trim() || null,
        followUpAssignedTo: incident.followUpAssignedTo,
      });
      onChanged();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to update this follow-up.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update follow-up"
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

        {incident.followUpNotes && <p className="text-sm text-content-secondary">{incident.followUpNotes}</p>}

        <div>
          <label htmlFor="follow-up-status" className="mb-1.5 block text-sm font-medium text-content-primary">
            Status
          </label>
          <select
            id="follow-up-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as BehaviourFollowUpStatus)}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <TextField label="Target date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
      </div>
    </Modal>
  );
}
