import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { leaveRequestService } from '@/features/employees/services/leaveRequestService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { LEAVE_TYPE_LABELS } from '@/features/employees/constants/leaveRequestLabels';
import type { LeaveRequest } from '@/features/employees/types/leaveRequest.types';

export interface ReviewLeaveRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: LeaveRequest;
  employeeName: string;
  onReviewed: () => void;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ReviewLeaveRequestDialog({ isOpen, onClose, request, employeeName, onReviewed }: ReviewLeaveRequestDialogProps) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<'approved' | 'rejected' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleReview = async (status: 'approved' | 'rejected') => {
    setSubmitError(null);
    setIsSubmitting(status);
    try {
      await leaveRequestService.reviewRequest(request.id, { status, reviewNotes: reviewNotes.trim() || null });
      onReviewed();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to record your decision.'));
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review leave request"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={() => void handleReview('rejected')} isLoading={isSubmitting === 'rejected'}>
              Reject
            </Button>
          </div>
          <div className="w-28">
            <Button type="button" onClick={() => void handleReview('approved')} isLoading={isSubmitting === 'approved'}>
              Approve
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

        <div>
          <p className="text-sm font-medium text-content-primary">{employeeName}</p>
          <p className="text-sm text-content-secondary">
            {LEAVE_TYPE_LABELS[request.leaveType]} · {formatDate(request.startDate)} – {formatDate(request.endDate)}
          </p>
          <p className="mt-2 text-sm text-content-secondary">{request.reason}</p>
        </div>

        <TextField label="Notes (optional)" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
      </div>
    </Modal>
  );
}
