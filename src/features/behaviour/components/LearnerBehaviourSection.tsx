import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useLearnerBehaviour } from '@/features/behaviour/hooks/useLearnerBehaviour';
import { behaviourService } from '@/features/behaviour/services/behaviourService';
import { BehaviourIncidentFormModal } from '@/features/behaviour/components/BehaviourIncidentFormModal';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LearnerBehaviourSectionProps {
  schoolId: string;
  learnerId: string;
  academicYearId: string | undefined;
  canManage: boolean;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SEVERITY_CLASSES: Record<string, string> = {
  low: 'bg-surface-sunken text-content-tertiary',
  medium: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  high: 'bg-danger-50 text-danger-600',
};

export function LearnerBehaviourSection({ schoolId, learnerId, academicYearId, canManage }: LearnerBehaviourSectionProps) {
  const { summary, isLoading, error, refetch } = useLearnerBehaviour(learnerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRemove = async (id: string) => {
    setActionError(null);
    try {
      await behaviourService.voidIncident(id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to remove incident.'));
    }
  };

  if (isLoading) {
    return <LoadingBlock label="Loading behaviour records…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorAlert message={error ?? actionError} />

      {canManage && academicYearId && (
        <div className="flex justify-end">
          <div className="w-full sm:w-auto sm:min-w-[10rem]">
            <Button type="button" onClick={() => setIsFormOpen(true)}>
              Record incident
            </Button>
          </div>
        </div>
      )}

      {!summary || summary.incidents.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No behaviour records for this learner.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {summary.incidents.map((incident) => (
            <div key={incident.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                      incident.incidentType === 'positive'
                        ? 'bg-success-500/15 text-success-500'
                        : incident.severity
                          ? SEVERITY_CLASSES[incident.severity]
                          : 'bg-surface-sunken text-content-tertiary'
                    }`}
                  >
                    {incident.incidentType}
                    {incident.severity ? ` · ${incident.severity}` : ''}
                  </span>
                  {incident.category && <span className="ml-2 text-xs text-content-tertiary">{incident.category}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-content-tertiary">{formatDateTime(incident.occurredAt)}</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(incident.id)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-content-primary">{incident.description}</p>
              {incident.actionTaken && (
                <p className="mt-1 text-sm text-content-secondary">
                  <span className="font-medium">Action taken:</span> {incident.actionTaken}
                </p>
              )}
              {incident.outcome && (
                <p className="mt-1 text-sm text-content-secondary">
                  <span className="font-medium">Outcome:</span> {incident.outcome}
                </p>
              )}
              {incident.followUpRequired && (
                <p className="mt-1 text-sm text-warning-600 dark:text-warning-500">
                  Follow-up required{incident.followUpNotes ? `: ${incident.followUpNotes}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {academicYearId && (
        <BehaviourIncidentFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={schoolId}
          learnerId={learnerId}
          academicYearId={academicYearId}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  );
}
