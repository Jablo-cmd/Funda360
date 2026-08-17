import type { MarkStats } from '@/features/assessments/utils/calculations';

export interface AssessmentSummaryPanelProps {
  stats: MarkStats;
  maxMark: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-content-primary">{value}</p>
    </div>
  );
}

export function AssessmentSummaryPanel({ stats, maxMark }: AssessmentSummaryPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface-raised p-4 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Learners" value={String(stats.totalCount)} />
      <Stat label="Marked" value={String(stats.markedCount)} />
      <Stat label="Outstanding" value={String(stats.unmarkedCount)} />
      <Stat label="Average" value={stats.averagePercentage === null ? '—' : `${stats.averagePercentage}%`} />
      <Stat
        label="Highest / Lowest"
        value={stats.highestMark === null ? '—' : `${stats.highestMark}/${maxMark} · ${stats.lowestMark}/${maxMark}`}
      />
    </div>
  );
}
