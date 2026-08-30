import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChangeLearnerStatusDialog } from '@/features/learners/components/ChangeLearnerStatusDialog';
import {
  ADMISSIONS_NEXT_STATUS,
  ADMISSIONS_PIPELINE_STAGES,
  LEARNER_STATUS_LABELS,
} from '@/features/learners/constants/learnerStatusLabels';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { Learner, LearnerStatus } from '@/features/learners/types/learner.types';

export interface AdmissionsPipelineBoardProps {
  columns: Record<LearnerStatus, Learner[]>;
  canManage: boolean;
  onMove: (learner: Learner, newStatus: LearnerStatus) => Promise<void>;
  onChanged: () => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface PipelineCardProps {
  learner: Learner;
  canManage: boolean;
  onMove: (learner: Learner, newStatus: LearnerStatus) => Promise<void>;
  onOpenStatusDialog: (learner: Learner) => void;
}

function PipelineCard({ learner, canManage, onMove, onOpenStatusDialog }: PipelineCardProps) {
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // The one legal "advance" transition out of this stage (see
  // ADMISSIONS_NEXT_STATUS's own doc comment for why there is no
  // corresponding "move back" action — the DB's transition whitelist is
  // strictly forward-only).
  const nextStatus = ADMISSIONS_NEXT_STATUS[learner.status];

  const handleAdvance = async () => {
    if (!nextStatus) return;
    setMoveError(null);
    setIsMoving(true);
    try {
      await onMove(learner, nextStatus);
    } catch (error) {
      setMoveError(getDbErrorMessage(error, 'Failed to move this applicant.'));
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <li className="rounded-lg border border-border-default bg-surface-raised p-3.5 shadow-sm">
      <Link to={`/learners/${learner.id}`} className="text-sm font-semibold text-content-primary hover:underline">
        {learner.firstName} {learner.lastName}
      </Link>
      <p className="mt-0.5 text-xs text-content-tertiary">
        {learner.admissionNumber} · applied {formatDate(learner.admissionDate)}
      </p>

      {moveError && <p className="mt-2 text-xs font-medium text-danger-600">{moveError}</p>}

      {canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStatus && (
            <button
              type="button"
              disabled={isMoving}
              onClick={() => void handleAdvance()}
              className="focus-ring rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:bg-brand-500/10 dark:text-brand-400"
            >
              {LEARNER_STATUS_LABELS[nextStatus]} →
            </button>
          )}
          <button
            type="button"
            disabled={isMoving}
            onClick={() => onOpenStatusDialog(learner)}
            className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-tertiary hover:bg-surface-hover disabled:opacity-50"
          >
            Other…
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * The admissions pipeline as an actual funnel-shaped board rather than a
 * per-learner status dropdown buried on each profile page (FND-SIS-006) —
 * each column is one of the four admissions stages, each card a single
 * applicant with a one-click "advance" action (the DB's only legal forward
 * transition for that stage — see ADMISSIONS_NEXT_STATUS) that calls the
 * exact same change_learner_status() RPC the profile page's own status
 * dialog already uses. "Other…" opens that same dialog directly for
 * anything a single click shouldn't do casually — withdrawing an
 * application, or any other transition the whitelist allows outside the
 * simple forward chain — reusing existing, tested UI rather than building
 * a second confirm flow for the rare case.
 */
export function AdmissionsPipelineBoard({ columns, canManage, onMove, onChanged }: AdmissionsPipelineBoardProps) {
  const [statusDialogLearner, setStatusDialogLearner] = useState<Learner | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ADMISSIONS_PIPELINE_STAGES.map((stage) => {
          const learners = columns[stage];
          return (
            <div key={stage} className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-base p-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-content-primary">{LEARNER_STATUS_LABELS[stage]}</h3>
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-content-tertiary">
                  {learners.length}
                </span>
              </div>

              {learners.length === 0 ? (
                <p className="px-1 text-xs text-content-tertiary">No applicants at this stage.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {learners.map((learner) => (
                    <PipelineCard
                      key={learner.id}
                      learner={learner}
                      canManage={canManage}
                      onMove={onMove}
                      onOpenStatusDialog={setStatusDialogLearner}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {statusDialogLearner && (
        <ChangeLearnerStatusDialog
          isOpen
          onClose={() => setStatusDialogLearner(null)}
          learner={statusDialogLearner}
          onChanged={() => {
            setStatusDialogLearner(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}
