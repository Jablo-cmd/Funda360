import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ReportCard } from '@/features/reportCards/types/reportCard.types';

export interface ReportCardWorkflowBarProps {
  card: ReportCard;
  canManage: boolean;
  canApprove: boolean;
  canReviewHod: boolean;
  requiresHodReview: boolean;
  onAction: (action: string, reason?: string) => Promise<void>;
}

interface ActionDef {
  action: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** When set, clicking reveals a reason field before the action fires. */
  reasonPrompt?: string;
  /** Whether the reason is mandatory (the DB rejects an empty one). */
  reasonRequired?: boolean;
}

/**
 * The status-transition controls. Which buttons appear is a function of the
 * current status + the caller's permissions — but the database RPCs are the
 * real gate; a button that shouldn't work simply won't (the error surfaces
 * inline on the page).
 */
export function ReportCardWorkflowBar({
  card,
  canManage,
  canApprove,
  canReviewHod,
  requiresHodReview,
  onAction,
}: ReportCardWorkflowBarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<ActionDef | null>(null);
  const [reason, setReason] = useState('');

  const actions: ActionDef[] = [];
  const editing = card.status === 'draft' || card.status === 'teacher_review' || card.status === 'hod_review';

  if (canManage && editing) actions.push({ action: 'recalculate', label: 'Recalculate marks', variant: 'ghost' });
  if (canManage && card.status === 'draft') actions.push({ action: 'submit', label: 'Submit for review', variant: 'primary' });
  if (canReviewHod && card.status === 'teacher_review') {
    actions.push({ action: 'hod_approve', label: 'Pass HOD review', variant: 'primary' });
    actions.push({ action: 'hod_return', label: 'Return to teacher', reasonPrompt: 'Note for the teacher (optional)' });
  }
  if (canApprove && (card.status === 'teacher_review' || card.status === 'hod_review')) {
    actions.push({
      action: 'approve',
      label: requiresHodReview && card.status !== 'hod_review' ? 'Approve (needs HOD first)' : 'Approve',
      variant: 'primary',
    });
  }
  if (canApprove && card.status === 'approved') {
    actions.push({ action: 'publish', label: 'Publish', variant: 'primary' });
    actions.push({ action: 'unapprove', label: 'Reopen', reasonPrompt: 'Why are you reopening this report card?', reasonRequired: true });
  }
  if (canApprove && (card.status === 'published' || (card.status === 'archived' && card.supersededBy === null))) {
    if (card.status === 'published') actions.push({ action: 'archive', label: 'Archive' });
    actions.push({ action: 'reissue', label: 'Reissue (new version)', reasonPrompt: 'Reason for reissuing', reasonRequired: true });
  }

  const run = async (def: ActionDef, providedReason?: string) => {
    setBusy(def.action);
    try {
      await onAction(def.action, providedReason);
      setReasonFor(null);
      setReason('');
    } finally {
      setBusy(null);
    }
  };

  if (actions.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface-raised px-3 py-2 text-xs text-content-tertiary">
        No workflow actions available to you for a {card.status.replace('_', ' ')} report card.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-raised p-3">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((def) => (
          <Button
            key={def.action}
            variant={def.variant ?? 'secondary'}
            isLoading={busy === def.action}
            onClick={() => (def.reasonPrompt ? setReasonFor(def) : run(def))}
          >
            {def.label}
          </Button>
        ))}
      </div>

      {reasonFor && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <input
            className="focus-ring h-10 min-w-[16rem] flex-1 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
            placeholder={reasonFor.reasonPrompt}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="primary"
            isLoading={busy === reasonFor.action}
            disabled={reasonFor.reasonRequired ? reason.trim().length === 0 : false}
            onClick={() => run(reasonFor, reason.trim())}
          >
            Confirm
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setReasonFor(null);
              setReason('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
