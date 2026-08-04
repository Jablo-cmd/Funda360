import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { learnerService } from '@/features/learners/services/learnerService';
import type { Learner, LearnerStatus } from '@/features/learners/types/learner.types';

export interface ChangeLearnerStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  learner: Learner;
  onChanged: (learner: Learner) => void;
}

const STATUS_OPTIONS: { value: LearnerStatus; label: string }[] = [
  { value: 'prospective', label: 'Prospective' },
  { value: 'applied', label: 'Applied' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export function ChangeLearnerStatusDialog({ isOpen, onClose, learner, onChanged }: ChangeLearnerStatusDialogProps) {
  const [newStatus, setNewStatus] = useState<LearnerStatus>(learner.status);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const updated = await learnerService.changeStatus(learner.id, newStatus, reason.trim() || null);
      onChanged(updated);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to change status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change learner status"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-40">
            <Button type="button" onClick={() => void handleConfirm()} isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Change status'}
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

        <div>
          <label htmlFor="learner-status" className="mb-1.5 block text-sm font-medium text-content-primary">
            New status
          </label>
          <select
            id="learner-status"
            value={newStatus}
            onChange={(event) => setNewStatus(event.target.value as LearnerStatus)}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
    </Modal>
  );
}
