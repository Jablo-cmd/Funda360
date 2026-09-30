import { useMemo, useState } from 'react';
import type { TeachingResourceRow, ToolkitStage } from '@/lib/database.types';
import { Tabs } from '@/components/ui/Tabs';
import {
  accessBadges,
  DIFFICULTY_LABEL,
  formatMinutes,
  groupByStage,
  TOOLKIT_STAGES,
  type BadgeTone,
} from '@/features/learning/utils/toolkit';

const TONE_CLASSES: Record<BadgeTone, string> = {
  good: 'bg-success-500/10 text-success-500',
  warn: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  neutral: 'bg-surface-sunken text-content-secondary',
};

export function AccessBadges({ resource }: { resource: TeachingResourceRow }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What you need to use this">
      {accessBadges(resource).map((badge) => (
        <li
          key={badge.label}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[badge.tone]}`}
        >
          {badge.label}
        </li>
      ))}
    </ul>
  );
}

export interface ToolkitPanelProps {
  resources: TeachingResourceRow[];
  onOpen: (resource: TeachingResourceRow) => void;
}

/** The Teacher Toolkit: Explain, Show, Try, Practise, Check, Support, Challenge and Print, each a set of separate resources. */
export function ToolkitPanel({ resources, onOpen }: ToolkitPanelProps) {
  const grouped = useMemo(() => groupByStage(resources), [resources]);
  const firstWithContent = TOOLKIT_STAGES.find((s) => grouped[s.key].length > 0)?.key ?? 'explain';
  const [stage, setStage] = useState<ToolkitStage>(firstWithContent);
  const active = TOOLKIT_STAGES.find((s) => s.key === stage) ?? TOOLKIT_STAGES[0]!;
  const items = grouped[active.key];

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        tabs={TOOLKIT_STAGES.map((s) => ({
          key: s.key,
          label: `${s.label} (${grouped[s.key].length})`,
        }))}
        activeTab={stage}
        onChange={setStage}
      />
      <p className="text-sm text-content-secondary">{active.hint}</p>
      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-content-tertiary">
          Nothing in {active.label} for this lesson yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((resource) => (
            <li
              key={resource.id}
              className="flex flex-col gap-2 rounded-card border border-border bg-surface-raised p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-base font-semibold text-content-primary">
                  {resource.title}
                </h3>
                <span className="shrink-0 text-xs text-content-tertiary">
                  {DIFFICULTY_LABEL[resource.difficulty]}
                  {formatMinutes(resource.estimated_minutes)
                    ? ` · ${formatMinutes(resource.estimated_minutes)}`
                    : ''}
                </span>
              </div>
              {resource.summary && (
                <p className="break-words text-sm text-content-secondary">{resource.summary}</p>
              )}
              <AccessBadges resource={resource} />
              <div>
                <button
                  type="button"
                  onClick={() => onOpen(resource)}
                  className="focus-ring inline-flex min-h-11 items-center rounded-md border border-border-strong px-4 text-sm font-semibold text-content-primary hover:bg-surface-sunken"
                >
                  Open
                  <span className="sr-only"> {resource.title}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
