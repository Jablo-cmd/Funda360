export interface SummaryBarProps {
  label: string;
  count: number;
  total: number;
}

/** A single labelled row with a proportional fill bar — no charting library, just a styled div sized by percentage. */
export function SummaryBar({ label, count, total }: SummaryBarProps) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium capitalize text-content-primary">{label.replace(/_/g, ' ')}</span>
        <span className="text-content-secondary">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
