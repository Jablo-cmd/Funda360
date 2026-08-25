import { Card } from '@/components/ui/Card';
import type { TimelineEvent, TimelineEventCategory } from '@/features/learners/types/timeline.types';

export interface TimelineCardProps {
  events: TimelineEvent[];
}

const CATEGORY_DOT_CLASSES: Record<TimelineEventCategory, string> = {
  academic: 'bg-brand-500',
  attendance: 'bg-success-500',
  guardian: 'bg-content-tertiary',
  financial: 'bg-warning-500',
  behaviour: 'bg-danger-500',
  enrolment: 'bg-content-tertiary',
};

function formatDate(value: string): string {
  const date = value.length > 10 ? new Date(value) : new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TimelineCard({ events }: TimelineCardProps) {
  return (
    <Card title="Recent Activity">
      {events.length === 0 ? (
        <p className="text-sm text-content-tertiary">No recent activity recorded for this learner.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT_CLASSES[event.category]}`} />
              <div className="min-w-0">
                <p className="text-sm text-content-primary">{event.label}</p>
                <p className="font-mono text-xs text-content-tertiary">{formatDate(event.date)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
