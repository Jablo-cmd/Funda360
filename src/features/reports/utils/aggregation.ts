/**
 * Generic, reusable aggregation helpers shared by every report service —
 * extracted once here rather than reimplemented per domain, since every
 * report in this module needs exactly one of these two shapes: "count
 * grouped by a key" or "count active vs. archived."
 */

/** Counts items grouped by whatever key `keyFn` returns. */
export function countBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, number> {
  const counts = {} as Record<K, number>;
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Counts how many items are active vs. archived, per whatever `isActiveFn` decides "active" means. */
export function countActiveVsTotal<T>(
  items: T[],
  isActiveFn: (item: T) => boolean,
): { active: number; archived: number; total: number } {
  const active = items.filter(isActiveFn).length;
  return { active, archived: items.length - active, total: items.length };
}
