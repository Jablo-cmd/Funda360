type ClassValue = string | number | null | undefined | false | Record<string, boolean | undefined>;

/**
 * Minimal class-name combinator (clsx-style) so components can compose
 * conditional Tailwind classes without pulling in an extra dependency.
 */
export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === 'string' || typeof value === 'number') {
      classes.push(String(value));
      continue;
    }

    for (const [key, condition] of Object.entries(value)) {
      if (condition) classes.push(key);
    }
  }

  return classes.join(' ');
}
