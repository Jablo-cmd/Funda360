import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { parseScore } from '@/features/learning/utils/toolkit';

export interface ResultLearner {
  id: string;
  name: string;
  learnerNumber: string;
}

export interface RecordResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentTitle: string;
  maxScore: number;
  learners: ResultLearner[];
  onSave: (
    entries: Array<{ learnerId: string; score: number }>,
  ) => Promise<{ saved: number; failed: string[] }>;
}

/** A teacher types one score per learner. Blank rows are skipped, so a partial class can be saved. */
export function RecordResultsModal({
  isOpen,
  onClose,
  assessmentTitle,
  maxScore,
  learners,
  onSave,
}: RecordResultsModalProps) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = learners.map((l) => ({
    learner: l,
    value: parseScore(scores[l.id] ?? '', maxScore),
  }));
  const hasInvalid = parsed.some((p) => p.value !== null && Number.isNaN(p.value));
  const entries = parsed.filter(
    (p): p is { learner: ResultLearner; value: number } =>
      p.value !== null && !Number.isNaN(p.value),
  );

  async function submit() {
    setIsSaving(true);
    setError(null);
    try {
      const result = await onSave(
        entries.map((e) => ({ learnerId: e.learner.id, score: e.value })),
      );
      if (result.failed.length > 0) {
        setError(`Saved ${result.saved}. Could not save: ${result.failed.join(', ')}.`);
      } else {
        setScores({});
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save these results. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record results"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <div className="sm:w-auto sm:min-w-[8rem]">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="sm:w-auto sm:min-w-[8rem]">
            <Button
              type="button"
              onClick={() => void submit()}
              isLoading={isSaving}
              disabled={entries.length === 0 || hasInvalid}
            >
              {entries.length > 0
                ? `Save ${entries.length} result${entries.length === 1 ? '' : 's'}`
                : 'Save results'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <ErrorAlert message={error} />
        <p className="break-words text-sm text-content-secondary">
          <strong className="text-content-primary">{assessmentTitle}</strong> — marked out of{' '}
          {maxScore}. Leave a row blank if the learner was absent.
        </p>
        <ul className="flex flex-col divide-y divide-border">
          {parsed.map(({ learner, value }) => {
            const invalid = value !== null && Number.isNaN(value);
            return (
              <li
                key={learner.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <label
                  htmlFor={`score-${learner.id}`}
                  className="min-w-0 flex-1 break-words text-sm text-content-primary"
                >
                  {learner.name}
                  <span className="block text-xs text-content-tertiary">
                    {learner.learnerNumber}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`score-${learner.id}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? `score-${learner.id}-error` : undefined}
                    value={scores[learner.id] ?? ''}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [learner.id]: e.target.value }))
                    }
                    className={`focus-ring h-11 w-24 rounded-md border bg-surface-raised px-3 text-right text-sm text-content-primary ${
                      invalid ? 'border-danger-500' : 'border-border-strong'
                    }`}
                  />
                  <span className="text-sm text-content-tertiary">/ {maxScore}</span>
                </div>
                {invalid && (
                  <p
                    id={`score-${learner.id}-error`}
                    className="w-full text-xs font-medium text-danger-600"
                  >
                    Enter a score from 0 to {maxScore}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
