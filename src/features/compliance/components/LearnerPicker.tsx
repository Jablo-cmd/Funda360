import { useEffect, useId, useState } from 'react';
import { searchLearners } from '@/features/compliance/services/complianceService';
import { SELECT_CLASS } from '@/features/compliance/utils/formatting';

export interface PickedLearner {
  id: string;
  name: string;
  learnerNumber: string;
}

/** Type-to-search learner selector for compliance forms (disclosures, paper consent, access-log filter). */
export function LearnerPicker({
  schoolId,
  value,
  onChange,
  label = 'Learner',
}: {
  schoolId: string;
  value: PickedLearner | null;
  onChange: (learner: PickedLearner | null) => void;
  label?: string;
}) {
  const id = useId();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PickedLearner[]>([]);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      searchLearners(schoolId, term)
        .then((rows) => {
          if (!cancelled)
            setResults(
              rows.map((r) => ({
                id: r.id,
                name: `${r.first_name} ${r.last_name}`,
                learnerNumber: r.learner_number,
              })),
            );
        })
        .catch((err: unknown) => console.error('Learner search failed', err));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [schoolId, term]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={`${id}-search`} className="block text-sm font-medium text-content-primary">
        {label}
      </label>
      <input
        id={`${id}-search`}
        className={SELECT_CLASS}
        placeholder="Search by name or learner number"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <select
        aria-label={`${label} — select from results`}
        className={SELECT_CLASS}
        value={value?.id ?? ''}
        onChange={(e) => onChange(results.find((r) => r.id === e.target.value) ?? null)}
      >
        <option value="">{results.length ? 'Select a learner' : 'No matches'}</option>
        {value && !results.some((r) => r.id === value.id) && (
          <option value={value.id}>
            {value.name} ({value.learnerNumber})
          </option>
        )}
        {results.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.learnerNumber})
          </option>
        ))}
      </select>
    </div>
  );
}
