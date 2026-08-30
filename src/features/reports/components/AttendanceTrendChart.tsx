import type { AttendanceTrendRow } from '@/features/reports/types/report.types';

export interface AttendanceTrendChartProps {
  data: AttendanceTrendRow[];
  /** A reference line at this rate (e.g. the same 80% "needs attention" threshold the learner table below already flags) — plotted only when at least one point exists, since an empty chart has nothing to give it context. */
  thresholdPercent?: number;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 180;
const PADDING = { top: 12, right: 12, bottom: 24, left: 32 };

function formatShortDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

/**
 * Deliberately hand-rolled SVG rather than a charting library — this is
 * one line, one threshold reference, and an x-axis with at most 3 labels;
 * a full charting dependency (tooltips, zoom, legends) would be a lot of
 * bundle weight for what this actually needs. Renders only points that
 * have a real rate (a day with zero qualifying attendance records is
 * skipped, not plotted as 0%) — see attendanceReportService's own
 * dailyRows comment for why gaps aren't zero-filled.
 */
export function AttendanceTrendChart({ data, thresholdPercent }: AttendanceTrendChartProps) {
  const points = data.filter((row): row is AttendanceTrendRow & { attendanceRate: number } => row.attendanceRate !== null);

  if (points.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-content-tertiary">
        No attendance recorded for this period yet.
      </div>
    );
  }

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const xFor = (index: number) => PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (rate: number) => PADDING.top + plotHeight * (1 - rate / 100);

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.attendanceRate)}`).join(' ');

  const rates = points.map((point) => point.attendanceRate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);

  // At most 3 x-axis labels (first, middle, last) regardless of how many
  // points are plotted — a label per day would overlap into an unreadable
  // smear once the selected range covers more than a couple of weeks.
  const labelIndexes = points.length <= 2 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Attendance rate trend from ${formatShortDate(points[0]!.date)} to ${formatShortDate(points[points.length - 1]!.date)}, ranging from ${minRate}% to ${maxRate}%`}
        className="h-[180px] w-full"
      >
        {[0, 25, 50, 75, 100].map((gridRate) => (
          <line
            key={gridRate}
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={yFor(gridRate)}
            y2={yFor(gridRate)}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}

        {thresholdPercent !== undefined && (
          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={yFor(thresholdPercent)}
            y2={yFor(thresholdPercent)}
            className="stroke-warning-500"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        <path d={linePath} fill="none" className="stroke-brand-600 dark:stroke-brand-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={xFor(index)}
            cy={yFor(point.attendanceRate)}
            r={2.5}
            className={
              thresholdPercent !== undefined && point.attendanceRate < thresholdPercent
                ? 'fill-danger-600'
                : 'fill-brand-600 dark:fill-brand-400'
            }
          />
        ))}

        {labelIndexes.map((index) => (
          <text
            key={index}
            x={xFor(index)}
            y={CHART_HEIGHT - 6}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            className="fill-content-tertiary text-[10px]"
          >
            {formatShortDate(points[index]!.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
