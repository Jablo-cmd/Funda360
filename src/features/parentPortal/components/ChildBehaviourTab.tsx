import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useGuardianVisibleBehaviour } from '@/features/behaviour/hooks/useGuardianVisibleBehaviour';

export interface ChildBehaviourTabProps {
  learnerId: string;
}

const SEVERITY_CLASSES: Record<string, string> = {
  low: 'bg-surface-sunken text-content-tertiary',
  medium: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  high: 'bg-danger-50 text-danger-600',
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Reads through get_guardian_visible_behaviour_incidents() only — never
 * queries behaviour_incidents directly. That RPC is both row-narrowed
 * (guardian_visible=true incidents for this guardian's own child only) and
 * column-narrowed (never action_taken/outcome/follow_up_notes — internal
 * staff commentary). See 20260829110000_behaviour_guardian_visibility.sql.
 * An incident with no guardian_visible flag set simply never appears here;
 * this is expected, not an error state.
 */
export function ChildBehaviourTab({ learnerId }: ChildBehaviourTabProps) {
  const { incidents, isLoading, error } = useGuardianVisibleBehaviour(learnerId);

  if (isLoading) {
    return <LoadingBlock label="Loading behaviour records…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorAlert message={error} />

      {incidents.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No behaviour records have been shared with you yet. Your school can share updates with you directly in the
          meantime.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {incidents.map((incident) => (
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
                <span className="font-mono text-xs text-content-tertiary">{formatDateTime(incident.occurredAt)}</span>
              </div>
              <p className="mt-2 text-sm text-content-primary">{incident.description}</p>
              {incident.followUpRequired && (
                <p className="mt-1 text-sm text-warning-600 dark:text-warning-500">Follow-up required</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
