import { LADDER_STEPS } from '@/features/content-studio/utils/review';

/** The five separate things "verified" can mean. Never merged into one status. */
export function LadderExplainer() {
  return (
    <details className="rounded-card border border-border p-3 text-sm text-content-secondary">
      <summary className="focus-ring cursor-pointer font-medium text-content-primary">
        What each step means
      </summary>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5" aria-label="Verification steps">
        {LADDER_STEPS.map((s) => (
          <li key={s.key} className="break-words">
            <strong className="text-content-primary">{s.label}.</strong> {s.meaning}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-content-tertiary">
        The first four describe a source document. The fifth describes one Funda360 unit and is
        decided one unit at a time. A unit being approved or published is a different thing again:
        that is its lifecycle, and it never implies verification.
      </p>
    </details>
  );
}
