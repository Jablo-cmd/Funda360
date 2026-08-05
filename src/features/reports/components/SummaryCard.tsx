export interface SummaryCardProps {
  label: string;
  value: string | number;
}

export function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
      <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-content-primary">{value}</dd>
    </div>
  );
}
