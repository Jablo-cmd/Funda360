/** Groups thousands for dashboard KPI tiles — e.g. 1284 -> "1,284". Plain digits, so screen readers announce the real number. */
export function formatStat(n: number): string {
  return Math.max(0, Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
