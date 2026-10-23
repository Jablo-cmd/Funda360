export type KpiTone = 'neutral' | 'good' | 'warning' | 'danger';

/** Tone for a rate against a threshold: below is danger, within 5 points above is warning. */
export function toneForRate(value: number | null, threshold: number): KpiTone {
  if (value === null) return 'neutral';
  if (value < threshold) return 'danger';
  if (value < threshold + 5) return 'warning';
  return 'good';
}
