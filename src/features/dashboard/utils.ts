/** Zero-pads to a fixed instrument-display width, then groups thousands — e.g. 1284 -> "01,284". */
export function formatStat(n: number): string {
  return Math.max(0, Math.round(n))
    .toString()
    .padStart(5, '0')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
