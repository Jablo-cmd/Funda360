import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useSafeguardingConcerns } from '@/features/safeguarding/hooks/useSafeguardingConcerns';
import { SafeguardingConcernFormModal } from '@/features/safeguarding/components/SafeguardingConcernFormModal';
import { UpdateSafeguardingConcernDialog } from '@/features/safeguarding/components/UpdateSafeguardingConcernDialog';
import type { SafeguardingConcern, SafeguardingSeverity, SafeguardingStatus } from '@/features/safeguarding/types/safeguarding.types';

export interface LearnerSafeguardingSectionProps {
  schoolId: string;
  learnerId: string;
}

const SEVERITY_STYLES: Record<SafeguardingSeverity, string> = {
  low: 'bg-surface-sunken text-content-tertiary',
  medium: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  high: 'bg-danger-50 text-danger-600',
  critical: 'bg-danger-600 text-white',
};

const STATUS_LABELS: Record<SafeguardingStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Confidential — this tab only ever renders when the caller holds
 * learner.view_safeguarding (school_owner/principal only, deliberately
 * narrower than behaviour/medical — see 20260829240000_safeguarding.sql's
 * own migration header). Never surfaced to a guardian, and not linked
 * from any general learner alert/summary view.
 */
export function LearnerSafeguardingSection({ schoolId, learnerId }: LearnerSafeguardingSectionProps) {
  const { concerns, isLoading, error, refetch } = useSafeguardingConcerns(learnerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SafeguardingConcern | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-warning-500/30 bg-warning-50 px-3.5 py-2.5 text-xs text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
        Confidential — visible only to the school owner and principal. Every entry and status change is recorded in the audit trail.
      </p>

      <div className="flex justify-end">
        <div className="w-full sm:w-auto sm:min-w-[9rem]">
          <Button type="button" onClick={() => setIsFormOpen(true)}>
            Record concern
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-content-tertiary">Loading…</p>
      ) : concerns.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised p-4 text-sm text-content-tertiary">
          No safeguarding concerns recorded for this learner.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {concerns.map((concern) => (
            <li key={concern.id} className="rounded-card border border-border bg-surface-raised p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${SEVERITY_STYLES[concern.severity]}`}>
                      {concern.severity}
                    </span>
                    <span className="text-xs font-medium text-content-tertiary">{STATUS_LABELS[concern.status]}</span>
                    {concern.category && <span className="text-xs text-content-tertiary">· {concern.category}</span>}
                  </div>
                  <p className="mt-1.5 text-sm text-content-secondary">{concern.description}</p>
                  {concern.actionTaken && <p className="mt-1.5 text-xs text-content-tertiary">Action taken: {concern.actionTaken}</p>}
                  {concern.confidentialNotes && <p className="mt-1.5 text-xs text-content-tertiary">Notes: {concern.confidentialNotes}</p>}
                  <p className="mt-1.5 text-[11px] text-content-tertiary">Recorded {formatDateTime(concern.createdAt)}</p>
                </div>
                <div className="w-full sm:w-auto sm:min-w-[9rem]">
                  <Button type="button" variant="secondary" onClick={() => setEditTarget(concern)}>
                    Update
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SafeguardingConcernFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        schoolId={schoolId}
        learnerId={learnerId}
        onSaved={() => void refetch()}
      />
      {editTarget && (
        <UpdateSafeguardingConcernDialog
          isOpen
          onClose={() => setEditTarget(null)}
          concern={editTarget}
          onChanged={() => void refetch()}
        />
      )}
    </div>
  );
}
