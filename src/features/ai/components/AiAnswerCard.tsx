import { useState } from 'react';
import { cn } from '@/lib/cn';
import { aiService } from '@/features/ai/services/aiService';
import { toolLabel } from '@/features/ai/utils/aiResponse';
import type { AiAnswer, AiFeedbackRating } from '@/features/ai/types/ai.types';

const CONFIDENCE_LABEL: Record<AiAnswer['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

const pill = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium';

/** One answer: the text, the figures it relied on (with verification), limitations and feedback. */
export function AiAnswerCard({ answer }: { answer: AiAnswer }) {
  const [rating, setRating] = useState<AiFeedbackRating | null>(null);
  const [reporting, setReporting] = useState(false);
  const [comment, setComment] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(value: AiFeedbackRating, text?: string) {
    setSending(true);
    setFeedbackError(null);
    try {
      await aiService.submitFeedback(answer.requestId, value, text);
      setRating(value);
      setReporting(false);
    } catch {
      setFeedbackError('Feedback could not be sent. Try again.');
    } finally {
      setSending(false);
    }
  }

  const lookups = answer.toolsUsed.filter((t) => t.status === 'ok' || t.status === 'empty');
  const refused = answer.toolsUsed.filter((t) => t.status === 'denied');

  return (
    <article
      aria-label="Funda AI answer"
      className="space-y-3 rounded-lg border border-border bg-surface-raised p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            pill,
            answer.confidence === 'low'
              ? 'border-warning-500/40 bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500'
              : 'border-border-strong text-content-secondary',
          )}
        >
          {CONFIDENCE_LABEL[answer.confidence]}
        </span>
        {answer.requiresHumanReview && (
          <span className={cn(pill, 'border-border-strong text-content-secondary')}>
            Draft: needs review by a person
          </span>
        )}
      </div>

      <p className="whitespace-pre-line break-words text-sm text-content-primary">
        {answer.answer}
      </p>

      {answer.evidence.length > 0 && (
        <section aria-label="Evidence">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            Evidence
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {answer.evidence.map((item, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="font-mono font-semibold text-content-primary">{item.value}</span>
                <span className="min-w-0 break-words text-content-secondary">
                  {item.claim}
                  {item.period ? ` (${item.period})` : ''}
                </span>
                <span
                  className={cn(
                    pill,
                    item.verified
                      ? 'border-border-strong text-content-secondary'
                      : 'border-warning-500/40 bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
                  )}
                >
                  {item.verified ? 'Matches Funda360 data' : 'Not verified'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.limitations.length > 0 && (
        <section aria-label="Limitations">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            Limitations
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-content-secondary">
            {answer.limitations.map((l, i) => (
              <li key={i} className="break-words">
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.declinedActions.length > 0 && (
        <section aria-label="Not done by Funda AI">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            Needs a person
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-content-secondary">
            {answer.declinedActions.map((d, i) => (
              <li key={i} className="break-words">
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(lookups.length > 0 || refused.length > 0) && (
        <p className="text-xs text-content-tertiary">
          {lookups.length > 0 && (
            <>Looked up: {[...new Set(lookups.map((t) => toolLabel(t.tool)))].join(', ')}. </>
          )}
          {refused.length > 0 && (
            <>
              Not available to you: {[...new Set(refused.map((t) => toolLabel(t.tool)))].join(', ')}
              .
            </>
          )}
        </p>
      )}

      <div className="border-t border-border pt-2">
        {rating ? (
          <p role="status" className="text-xs text-content-secondary">
            {rating === 'problem'
              ? 'Thanks. The problem has been reported.'
              : 'Thanks for the feedback.'}
          </p>
        ) : reporting ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send('problem', comment);
            }}
          >
            <label
              htmlFor={`ai-problem-${answer.requestId}`}
              className="block text-xs font-medium text-content-secondary"
            >
              What is wrong with this answer? (optional)
            </label>
            <textarea
              id={`ai-problem-${answer.requestId}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={2}
              className="focus-ring w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-base text-content-primary sm:text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sending}
                className="focus-ring h-11 rounded-md bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-500 lg:h-9"
              >
                Send report
              </button>
              <button
                type="button"
                onClick={() => setReporting(false)}
                className="focus-ring h-11 rounded-md border border-border-strong px-3 text-sm text-content-secondary lg:h-9"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-content-tertiary">Was this useful?</span>
            {(
              [
                ['helpful', 'Helpful'],
                ['not_helpful', 'Not helpful'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={sending}
                onClick={() => void send(value)}
                className="focus-ring h-11 rounded-md border border-border-strong px-3 text-xs font-medium text-content-secondary hover:bg-surface-sunken lg:h-8"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="focus-ring h-11 rounded-md px-3 text-xs font-medium text-content-secondary underline hover:text-content-primary lg:h-8"
            >
              Report a problem
            </button>
          </div>
        )}
        {feedbackError && <p className="mt-1 text-xs text-danger-600">{feedbackError}</p>}
      </div>
    </article>
  );
}
