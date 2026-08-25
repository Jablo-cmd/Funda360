import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import type { LearnerBehaviourSummary } from '@/features/behaviour/types/behaviour.types';

export interface BehaviourSummaryCardProps {
  summary: LearnerBehaviourSummary | null;
  isLoading: boolean;
  error: string | null;
  onViewAll: () => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function BehaviourSummaryCard({ summary, isLoading, error, onViewAll }: BehaviourSummaryCardProps) {
  return (
    <Card
      title="Behaviour"
      action={
        <button type="button" onClick={onViewAll} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          View all
        </button>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Loading behaviour summary…" compact />
      ) : error ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : !summary || summary.incidents.length === 0 ? (
        <p className="text-sm text-content-tertiary">No behaviour records for this learner.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              summary.hasRecentNegative
                ? 'bg-danger-50 text-danger-600'
                : 'bg-success-500/15 text-success-500'
            }`}
          >
            {summary.hasRecentNegative ? 'Attention Required' : 'Good'}
          </span>
          <div className="flex gap-4 text-sm">
            <span className="text-content-secondary">
              <span className="font-mono font-medium text-content-primary">{summary.positiveCount}</span> positive
            </span>
            <span className="text-content-secondary">
              <span className="font-mono font-medium text-content-primary">{summary.negativeCount}</span> negative
            </span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {summary.incidents.slice(0, 3).map((incident) => (
              <div key={incident.id} className="py-2 first:pt-0 last:pb-0">
                <p className="text-sm text-content-primary">{incident.description}</p>
                <p className="text-xs text-content-tertiary">
                  {formatDateTime(incident.occurredAt)}
                  {incident.category ? ` · ${incident.category}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
