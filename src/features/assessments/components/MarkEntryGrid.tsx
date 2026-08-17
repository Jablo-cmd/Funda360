import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { toPercentage } from '@/features/assessments/utils/calculations';
import type { RosterLearner } from '@/features/assessments/types/assessment.types';

export interface MarkEntryGridProps {
  roster: RosterLearner[];
  /** Controlled as strings so a blank field is representable — never coerce blank to "0". */
  marks: Record<string, string>;
  onChange: (learnerId: string, value: string) => void;
  maxMark: number;
  readOnly: boolean;
}

/**
 * One responsive component, not two duplicated ones — a table on tablet/
 * desktop, a vertical card-per-learner list on mobile, sharing the same
 * controlled `marks` state and onChange handler so there is exactly one
 * source of truth regardless of which markup is visible at a given
 * viewport width.
 */
export function MarkEntryGrid({ roster, marks, onChange, maxMark, readOnly }: MarkEntryGridProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Enter' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const next = roster[index + 1];
    if (next) inputRefs.current[next.id]?.focus();
  };

  if (roster.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No learners enrolled in this class yet.
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-card border border-border bg-surface-raised md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
              <th scope="col" className="px-4 py-3 font-medium">
                Learner
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Learner #
              </th>
              <th scope="col" className="w-32 px-4 py-3 text-right font-medium">
                Mark
              </th>
              <th scope="col" className="w-20 px-4 py-3 text-right font-medium">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {roster.map((learner, index) => {
              const raw = marks[learner.id] ?? '';
              const numeric = raw === '' ? undefined : Number(raw);
              return (
                <tr key={learner.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-content-primary">
                    {learner.firstName} {learner.lastName}
                  </td>
                  <td className="px-4 py-3 text-content-secondary">{learner.learnerNumber}</td>
                  <td className="px-4 py-3 text-right">
                    <label className="sr-only" htmlFor={`mark-${learner.id}`}>
                      Mark for {learner.firstName} {learner.lastName}
                    </label>
                    <input
                      id={`mark-${learner.id}`}
                      ref={(el) => {
                        inputRefs.current[learner.id] = el;
                      }}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={maxMark}
                      step={1}
                      placeholder="—"
                      value={raw}
                      disabled={readOnly}
                      onChange={(event) => onChange(learner.id, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, index)}
                      className="focus-ring h-10 w-24 rounded-md border border-border-strong bg-surface-raised px-2.5 text-right font-mono text-sm text-content-primary disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-content-secondary">
                    {numeric === undefined || Number.isNaN(numeric) ? '—' : `${toPercentage(numeric, maxMark)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per learner */}
      <div className="flex flex-col gap-2 md:hidden">
        {roster.map((learner, index) => {
          const raw = marks[learner.id] ?? '';
          const numeric = raw === '' ? undefined : Number(raw);
          return (
            <div key={learner.id} className="rounded-card border border-border bg-surface-raised p-3.5">
              <p className="text-sm font-medium text-content-primary">
                {learner.firstName} {learner.lastName}
              </p>
              <p className="text-xs text-content-tertiary">{learner.learnerNumber}</p>
              <div className="mt-2.5 flex items-center gap-3">
                <label className="sr-only" htmlFor={`mark-mobile-${learner.id}`}>
                  Mark for {learner.firstName} {learner.lastName}
                </label>
                <input
                  id={`mark-mobile-${learner.id}`}
                  ref={(el) => {
                    inputRefs.current[`mobile-${learner.id}`] = el;
                  }}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={maxMark}
                  step={1}
                  placeholder="—"
                  value={raw}
                  disabled={readOnly}
                  onChange={(event) => onChange(learner.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const next = roster[index + 1];
                    if (next) inputRefs.current[`mobile-${next.id}`]?.focus();
                  }}
                  className="focus-ring h-11 w-20 rounded-md border border-border-strong bg-surface-raised px-2.5 text-center font-mono text-base text-content-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="font-mono text-sm text-content-secondary">/ {maxMark}</span>
                <span className="ml-auto font-mono text-sm font-semibold text-content-primary">
                  {numeric === undefined || Number.isNaN(numeric) ? '—' : `${toPercentage(numeric, maxMark)}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
